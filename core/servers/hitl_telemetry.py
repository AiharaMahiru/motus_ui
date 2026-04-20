from __future__ import annotations

import logging
from copy import deepcopy
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from core.agents.multi_agent import MultiAgentUsageTracker
from core.config.paths import HITL_SESSIONS_DIR
from core.llm.costs import calculate_usage_cost, diff_usage, merge_usage
from core.schemas.multi_agent import AgentMetrics
from core.schemas.session import PersistedAgentUsageLedger, SessionCreateRequest, TurnMetrics
from core.chat.utils import utc_now_iso


logger = logging.getLogger(__name__)


def default_context_window_usage() -> dict[str, Any]:
    """为无 telemetry 的新会话提供稳定默认值。"""

    return {
        "estimated_tokens": 0,
        "threshold": 0,
        "ratio": 0.0,
        "percent": "0%",
    }


class HitlTelemetryManifest(BaseModel):
    """HITL 会话的 usage/cost/context telemetry 侧车。"""

    session_id: str
    root_usage: dict[str, Any] = Field(default_factory=dict)
    root_cost_usd: float | None = 0.0
    specialist_ledgers: list[PersistedAgentUsageLedger] = Field(default_factory=list)
    total_usage: dict[str, Any] = Field(default_factory=dict)
    total_cost_usd: float | None = 0.0
    context_window: dict[str, Any] = Field(default_factory=default_context_window_usage)
    last_turn_metrics: TurnMetrics | None = None
    updated_at: str


def get_hitl_session_telemetry_path(session_id: str) -> Path:
    """返回 HITL telemetry 文件路径。"""

    return HITL_SESSIONS_DIR / session_id / "telemetry.json"


def load_hitl_session_telemetry(session_id: str) -> HitlTelemetryManifest | None:
    """读取 HITL telemetry 快照。"""

    path = get_hitl_session_telemetry_path(session_id)
    if not path.exists():
        return None
    try:
        return HitlTelemetryManifest.model_validate_json(path.read_text(encoding="utf-8"))
    except Exception:
        logger.warning("加载 HITL telemetry 失败: %s", path, exc_info=True)
        return None


def save_hitl_session_telemetry(manifest: HitlTelemetryManifest) -> HitlTelemetryManifest:
    """写回 HITL telemetry 快照。"""

    path = get_hitl_session_telemetry_path(manifest.session_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        manifest.model_dump_json(indent=2, exclude_none=True),
        encoding="utf-8",
    )
    return manifest


def seed_agent_usage(agent: Any, usage: dict[str, Any]) -> None:
    """把累计 root usage 回灌到 agent，确保跨 turn 延续统计。"""

    live_usage = getattr(agent, "_usage", None)
    if isinstance(live_usage, dict):
        live_usage.clear()
        live_usage.update(deepcopy(usage))
        return

    # 兼容少量非 ReActAgent 的测试替身。
    public_usage = getattr(agent, "usage", None)
    if isinstance(public_usage, dict):
        public_usage.clear()
        public_usage.update(deepcopy(usage))


def _combine_costs(root_cost: float | None, specialist_cost: float | None) -> float | None:
    """组合 root 与 specialist 成本，语义与本地 backend 保持一致。"""

    if specialist_cost is None or root_cost is None:
        if specialist_cost == 0.0 and root_cost is not None:
            return root_cost
        return None
    return root_cost + specialist_cost


def _aggregate_turn_cost(agent_metrics: list[AgentMetrics]) -> float | None:
    active_metrics = [metric for metric in agent_metrics if metric.turn_usage]
    if not active_metrics:
        return 0.0
    if any(metric.turn_cost_usd is None for metric in active_metrics):
        return None
    return sum(metric.turn_cost_usd or 0.0 for metric in active_metrics)


class HitlTelemetryTracker:
    """把每轮 HITL agent 执行结果落成可恢复的 telemetry。"""

    def __init__(
        self,
        *,
        session_id: str,
        config: SessionCreateRequest,
        specialist_usage_tracker: MultiAgentUsageTracker,
    ) -> None:
        self.session_id = session_id
        self.config = config
        self.specialist_usage_tracker = specialist_usage_tracker
        self.agent: Any | None = None

        manifest = load_hitl_session_telemetry(session_id)
        self._baseline_root_usage = deepcopy(manifest.root_usage if manifest else {})
        self._baseline_root_cost_usd = manifest.root_cost_usd if manifest else 0.0
        if manifest is not None:
            self.specialist_usage_tracker.load_state(
                [item.model_dump(exclude_none=False) for item in manifest.specialist_ledgers]
            )
        self._baseline_specialist_snapshot = self.specialist_usage_tracker.snapshot()
        self._baseline_session_usage = deepcopy(
            manifest.total_usage
            if manifest is not None
            else merge_usage(
                self._baseline_root_usage,
                self.specialist_usage_tracker.total_usage(),
            )
        )
        self._baseline_total_cost_usd = (
            manifest.total_cost_usd
            if manifest is not None
            else _combine_costs(
                self._baseline_root_cost_usd,
                self.specialist_usage_tracker.total_cost(),
            )
        )
        self._last_turn_metrics = manifest.last_turn_metrics if manifest is not None else None
        self._last_context_window = deepcopy(
            manifest.context_window if manifest is not None else default_context_window_usage()
        )

    def attach_agent(self, agent: Any) -> None:
        """绑定当前 turn 的 agent，并回灌已累计 usage。"""

        self.agent = agent
        seed_agent_usage(agent, self._baseline_root_usage)

    def current_root_usage(self) -> dict[str, Any]:
        if self.agent is None:
            return deepcopy(self._baseline_root_usage)
        return deepcopy(getattr(self.agent, "usage", {}))

    def current_root_turn_usage(self) -> dict[str, Any]:
        return diff_usage(self._baseline_root_usage, self.current_root_usage())

    def current_root_cost(self) -> float | None:
        current_turn_root_cost = calculate_usage_cost(
            self.config.model_name,
            self.current_root_turn_usage(),
            pricing_model=self.config.pricing_model,
        )
        if self._baseline_root_cost_usd is None or current_turn_root_cost is None:
            return None
        return self._baseline_root_cost_usd + current_turn_root_cost

    def current_total_usage(self) -> dict[str, Any]:
        return merge_usage(
            self.current_root_usage(),
            self.specialist_usage_tracker.total_usage(),
        )

    def current_total_cost(self) -> float | None:
        return _combine_costs(
            self.current_root_cost(),
            self.specialist_usage_tracker.total_cost(),
        )

    def current_context_window(self) -> dict[str, Any]:
        if self.agent is None:
            return deepcopy(self._last_context_window)
        context_window = getattr(self.agent, "context_window_usage", None)
        if isinstance(context_window, dict) and context_window:
            return deepcopy(context_window)
        return deepcopy(self._last_context_window)

    def build_agent_metrics(self) -> list[AgentMetrics]:
        root_usage_after = self.current_root_usage()
        root_turn_usage = diff_usage(self._baseline_root_usage, root_usage_after)
        root_turn_cost = calculate_usage_cost(
            self.config.model_name,
            root_turn_usage,
            pricing_model=self.config.pricing_model,
        )
        metrics = [
            AgentMetrics(
                agent_name=self.config.multi_agent.supervisor_name,
                role="supervisor",
                model_name=self.config.model_name,
                pricing_model=self.config.pricing_model,
                stateful=True,
                turn_usage=root_turn_usage,
                session_usage=deepcopy(root_usage_after),
                turn_cost_usd=root_turn_cost,
                session_cost_usd=self.current_root_cost(),
            )
        ]
        metrics.extend(
            self.specialist_usage_tracker.build_metrics(
                self._baseline_specialist_snapshot,
                self.specialist_usage_tracker.snapshot(),
            )
        )
        return metrics

    def build_turn_metrics(self) -> TurnMetrics:
        session_usage = self.current_total_usage()
        agent_metrics = self.build_agent_metrics()
        return TurnMetrics(
            turn_usage=diff_usage(self._baseline_session_usage, session_usage),
            session_usage=session_usage,
            turn_cost_usd=_aggregate_turn_cost(agent_metrics),
            session_cost_usd=self.current_total_cost(),
            context_window=self.current_context_window(),
            agent_metrics=agent_metrics,
        )

    def persist(self, *, metrics: TurnMetrics | None = None) -> HitlTelemetryManifest:
        """把当前 telemetry 写回磁盘。

        这里不会改写 baseline，避免同一 turn 内多次落盘后 turn diff 被归零。
        """

        resolved_metrics = metrics or self.build_turn_metrics()
        manifest = HitlTelemetryManifest(
            session_id=self.session_id,
            root_usage=self.current_root_usage(),
            root_cost_usd=self.current_root_cost(),
            specialist_ledgers=[
                PersistedAgentUsageLedger.model_validate(item)
                for item in self.specialist_usage_tracker.export_state()
            ],
            total_usage=resolved_metrics.session_usage,
            total_cost_usd=resolved_metrics.session_cost_usd,
            context_window=resolved_metrics.context_window,
            last_turn_metrics=resolved_metrics,
            updated_at=utc_now_iso(),
        )
        self._last_turn_metrics = resolved_metrics
        self._last_context_window = deepcopy(resolved_metrics.context_window)
        return save_hitl_session_telemetry(manifest)

    def restore_last_turn_metrics(self) -> TurnMetrics | None:
        return self._last_turn_metrics


def load_hitl_last_turn_metrics(session_id: str) -> TurnMetrics | None:
    """读取最近一轮落盘指标。"""

    manifest = load_hitl_session_telemetry(session_id)
    if manifest is None:
        return None
    return manifest.last_turn_metrics
