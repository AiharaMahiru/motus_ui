from __future__ import annotations

import time
from copy import deepcopy
from typing import Any

from core.config.paths import PROJECT_ROOT
from core.llm.costs import calculate_usage_cost, diff_usage, merge_usage
from core.schemas.multi_agent import AgentMetrics
from core.schemas.session import PersistedAgentUsageLedger, SessionCreateRequest, SessionDetail, SessionSummary, SessionUpdateRequest
from core.tracing import get_session_trace_dir
from .utils import utc_now_iso


class ChatSessionStateMixin:
    def _mark_turn_activity(self) -> None:
        self._last_activity_monotonic = time.monotonic()

    def _has_title(self) -> bool:
        return bool(self.config.title and self.config.title.strip())

    async def ensure_title(self) -> str | None:
        if self._has_title() or self.title_service is None:
            return self.config.title
        generated_title = await self.title_service.generate(
            messages=self.history(),
            session_id=self.session_id,
        )
        if generated_title:
            self.config.title = generated_title
        return self.config.title

    def ensure_fallback_title(self) -> str | None:
        if self._has_title():
            return self.config.title
        if self.title_service is not None:
            self.config.title = self.title_service.fallback_title(
                messages=self.history(),
                session_id=self.session_id,
            )
        else:
            self.config.title = f"会话 {self.session_id[:8]}"
        return self.config.title

    def _stale_running_threshold_seconds(self) -> float:
        configured_timeout = float(self.config.timeout_seconds or 600.0)
        return max(configured_timeout + 30.0, 90.0)

    def _reconcile_runtime_state(self) -> None:
        """统一修正运行态，避免前端永久看到“进行中”。"""

        if self.status != "running":
            return

        next_status: str | None = None
        should_cancel = False

        if not self._lock.locked():
            if not self.last_error:
                self.last_error = "会话在运行中丢失执行上下文，已自动标记异常，请重新发起本轮请求"
            next_status = "error"
        elif self._active_turn_task is None:
            if not self.last_error:
                self.last_error = "会话缺少活动任务句柄，已自动标记异常，请重新发起本轮请求"
            next_status = "error"
        elif self._active_turn_task is not None and self._active_turn_task.done():
            if not self.last_error:
                self.last_error = "会话执行任务异常退出，已自动标记异常，请重新发起本轮请求"
            next_status = "error"
        elif self._last_activity_monotonic is not None:
            idle_seconds = time.monotonic() - self._last_activity_monotonic
            if idle_seconds > self._stale_running_threshold_seconds():
                timeout_limit = int(self.config.timeout_seconds or 600)
                if not self.last_error:
                    self.last_error = f"会话执行超过 {timeout_limit}s 未结束，已自动取消并标记异常"
                next_status = "error"
                should_cancel = True

        if next_status is None:
            return

        self.status = next_status
        self.updated_at = utc_now_iso()
        if should_cancel and self._active_turn_task is not None and not self._active_turn_task.done():
            self._active_turn_task.cancel()
        self.persist()

    def aggregate_usage(self) -> dict[str, Any]:
        return merge_usage(self.agent.usage, self.specialist_usage_tracker.total_usage())

    def aggregate_total_cost(self) -> float | None:
        root_cost = calculate_usage_cost(
            self.config.model_name,
            self.agent.usage,
            pricing_model=self.config.pricing_model,
        )
        specialist_cost = self.specialist_usage_tracker.total_cost()
        if specialist_cost is None or root_cost is None:
            if specialist_cost == 0.0 and root_cost is not None:
                return root_cost
            return None
        return root_cost + specialist_cost

    def build_agent_metrics(
        self,
        *,
        root_usage_before: dict[str, Any],
        root_usage_after: dict[str, Any],
        specialist_before: dict[str, Any],
        specialist_after: dict[str, Any],
    ) -> list[AgentMetrics]:
        root_turn_usage = diff_usage(root_usage_before, root_usage_after)
        root_session_cost = calculate_usage_cost(
            self.config.model_name,
            root_usage_after,
            pricing_model=self.config.pricing_model,
        )
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
                session_cost_usd=root_session_cost,
            )
        ]
        metrics.extend(self.specialist_usage_tracker.build_metrics(specialist_before, specialist_after))
        return metrics

    def aggregate_turn_cost(self, agent_metrics: list[AgentMetrics]) -> float | None:
        active_metrics = [metric for metric in agent_metrics if metric.turn_usage]
        if not active_metrics:
            return 0.0
        if any(metric.turn_cost_usd is None for metric in active_metrics):
            return None
        return sum(metric.turn_cost_usd or 0.0 for metric in active_metrics)

    def summary(self) -> SessionSummary:
        self._reconcile_runtime_state()
        usage = self.aggregate_usage()
        return SessionSummary(
            session_id=self.session_id,
            title=self.config.title,
            status=self.status,  # type: ignore[arg-type]
            model_name=self.config.model_name,
            created_at=self.created_at,
            updated_at=self.updated_at,
            message_count=len(self.agent.memory.messages),
            total_usage=usage,
            total_cost_usd=self.aggregate_total_cost(),
            last_error=self.last_error,
            multi_agent_enabled=self.config.multi_agent.enabled(),
            specialist_count=self.config.multi_agent.specialist_count(),
            project_root=str(PROJECT_ROOT),
            trace_log_dir=str(get_session_trace_dir(self.session_id)),
        )

    def detail(self) -> SessionDetail:
        summary = self.summary()
        return SessionDetail(
            **summary.model_dump(),
            system_prompt=self.config.system_prompt,
            provider=self.config.provider,
            model_client=self.config.model_client,
            pricing_model=self.config.pricing_model,
            cache_policy=self.config.cache_policy,
            max_steps=self.config.max_steps,
            timeout_seconds=self.config.timeout_seconds,
            thinking=self.config.thinking,
            enabled_tools=list(self.config.enabled_tools),
            mcp_servers=list(self.config.mcp_servers),
            multi_agent=self.config.multi_agent,
            sandbox=self.config.sandbox,
            human_in_the_loop=self.config.human_in_the_loop,
            approval_tool_names=list(self.config.approval_tool_names),
            input_guardrails=list(self.config.input_guardrails),
            output_guardrails=list(self.config.output_guardrails),
            tool_guardrails=list(self.config.tool_guardrails),
            response_format=self.config.response_format,
            memory=self.config.memory,
            context_window=self.agent.context_window_usage,
            last_response=self.last_response,
            interrupts=None,
            resume_supported=False,
            resume_blocked_reason="本地 backend 不支持 interrupt/resume",
        )

    def reconfigure(self, update: SessionUpdateRequest) -> SessionDetail:
        """热更新当前会话配置，并保留既有历史消息与 usage。"""

        if self._lock.locked():
            raise RuntimeError("当前会话正在处理中，暂时不能修改配置")

        changes = update.model_dump(exclude_unset=True)
        if not changes:
            return self.detail()

        next_config = SessionCreateRequest.model_validate(
            {
                **self.config.model_dump(exclude_none=False),
                **changes,
            }
        )
        if self.config.memory != next_config.memory:
            memory = None
        else:
            memory = self.agent.memory
        root_usage = deepcopy(self.agent.usage)
        specialist_ledgers = [
            PersistedAgentUsageLedger.model_validate(item)
            for item in self.specialist_usage_tracker.export_state()
        ]

        self._build_agent(
            config=next_config,
            memory=memory,
            root_usage=root_usage,
            specialist_ledgers=specialist_ledgers,
        )
        self.updated_at = utc_now_iso()
        self.persist()
        return self.detail()
