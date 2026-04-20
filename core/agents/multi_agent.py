from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any

from motus.tools.core.agent_tool import AgentTool

from core.llm.costs import calculate_usage_cost, diff_usage, merge_usage
from core.schemas.multi_agent import AgentMetrics


@dataclass
class AgentUsageLedger:
    """单个子代理的累计 usage/cost 台账。"""

    agent_name: str
    model_name: str
    pricing_model: str | None
    role: str
    stateful: bool
    session_usage: dict[str, Any] = field(default_factory=dict)
    session_cost_usd: float | None = 0.0


class MultiAgentUsageTracker:
    """记录多代理树里所有非根 agent 的 usage/cost。

    根 agent 仍然可以直接从 `root_agent.usage` 读取；子代理如果通过工具被调用，
    其 usage 不会自动汇总到根 agent，所以需要这一层补齐统计。
    """

    def __init__(self) -> None:
        self._ledgers: dict[str, AgentUsageLedger] = {}

    def snapshot(self) -> dict[str, AgentUsageLedger]:
        """返回当前台账快照，用于在一次 turn 前后做 diff。"""

        return {
            name: AgentUsageLedger(
                agent_name=ledger.agent_name,
                model_name=ledger.model_name,
                pricing_model=ledger.pricing_model,
                role=ledger.role,
                stateful=ledger.stateful,
                session_usage=deepcopy(ledger.session_usage),
                session_cost_usd=ledger.session_cost_usd,
            )
            for name, ledger in self._ledgers.items()
        }

    def record_delta(
        self,
        *,
        agent_name: str,
        model_name: str,
        pricing_model: str | None,
        role: str,
        stateful: bool,
        delta_usage: dict[str, Any],
    ) -> None:
        """把一次子代理调用的 usage 增量追加到账本里。"""

        if not delta_usage:
            return

        ledger = self._ledgers.get(agent_name)
        if ledger is None:
            ledger = AgentUsageLedger(
                agent_name=agent_name,
                model_name=model_name,
                pricing_model=pricing_model,
                role=role,
                stateful=stateful,
            )
            self._ledgers[agent_name] = ledger

        ledger.session_usage = merge_usage(ledger.session_usage, delta_usage)
        delta_cost = calculate_usage_cost(model_name, delta_usage, pricing_model=pricing_model)
        if delta_cost is None:
            ledger.session_cost_usd = None
        elif ledger.session_cost_usd is not None:
            ledger.session_cost_usd += delta_cost

    def total_usage(self) -> dict[str, Any]:
        return merge_usage(*(ledger.session_usage for ledger in self._ledgers.values()))

    def total_cost(self) -> float | None:
        if not self._ledgers:
            return 0.0
        values = [ledger.session_cost_usd for ledger in self._ledgers.values()]
        if any(value is None for value in values):
            return None
        return sum(value or 0.0 for value in values)

    def export_state(self) -> list[dict[str, Any]]:
        """导出当前台账，供 session manifest 持久化使用。"""

        return [
            {
                "agent_name": ledger.agent_name,
                "model_name": ledger.model_name,
                "pricing_model": ledger.pricing_model,
                "role": ledger.role,
                "stateful": ledger.stateful,
                "session_usage": deepcopy(ledger.session_usage),
                "session_cost_usd": ledger.session_cost_usd,
            }
            for ledger in self._ledgers.values()
        ]

    def load_state(self, ledgers: list[dict[str, Any]]) -> None:
        """从持久化数据恢复台账。"""

        self._ledgers = {}
        for item in ledgers:
            agent_name = item.get("agent_name")
            model_name = item.get("model_name")
            role = item.get("role")
            if not agent_name or not model_name or not role:
                continue

            self._ledgers[agent_name] = AgentUsageLedger(
                agent_name=agent_name,
                model_name=model_name,
                pricing_model=item.get("pricing_model"),
                role=role,
                stateful=bool(item.get("stateful", False)),
                session_usage=deepcopy(item.get("session_usage", {})),
                session_cost_usd=item.get("session_cost_usd"),
            )

    def build_metrics(
        self,
        before: dict[str, AgentUsageLedger],
        after: dict[str, AgentUsageLedger],
    ) -> list[AgentMetrics]:
        """把一次 turn 前后的台账差异转换成可序列化的 agent 指标。"""

        metrics: list[AgentMetrics] = []
        for agent_name in sorted(after):
            current = after[agent_name]
            previous = before.get(agent_name)
            before_usage = previous.session_usage if previous else {}
            before_cost = previous.session_cost_usd if previous else 0.0

            turn_usage = diff_usage(before_usage, current.session_usage)
            if current.session_cost_usd is None or before_cost is None:
                turn_cost = None
            else:
                turn_cost = current.session_cost_usd - before_cost

            metrics.append(
                AgentMetrics(
                    agent_name=current.agent_name,
                    role=current.role,  # type: ignore[arg-type]
                    model_name=current.model_name,
                    pricing_model=current.pricing_model,
                    stateful=current.stateful,
                    turn_usage=turn_usage,
                    session_usage=deepcopy(current.session_usage),
                    turn_cost_usd=turn_cost,
                    session_cost_usd=current.session_cost_usd,
                )
            )
        return metrics


class TrackedAgentTool(AgentTool):
    """与官方 AgentTool 语义保持一致，但额外记录 usage/cost。

    直接使用 `agent.as_tool()` 时，子代理的 usage 不会自动进入根 agent 的 usage。
    这里复用官方 AgentTool 的核心行为，并在调用边界记录实际增量。
    """

    def __init__(
        self,
        agent: Any,
        *,
        tracker: MultiAgentUsageTracker,
        agent_name: str,
        model_name: str,
        pricing_model: str | None,
        role: str = "specialist",
        name: str | None = None,
        description: str | None = None,
        output_extractor: Any = None,
        stateful: bool = False,
        max_steps: int | None = None,
        input_guardrails: list | None = None,
        output_guardrails: list | None = None,
    ) -> None:
        super().__init__(
            agent,
            name=name,
            description=description,
            output_extractor=output_extractor,
            stateful=stateful,
            max_steps=max_steps,
            input_guardrails=input_guardrails,
            output_guardrails=output_guardrails,
        )
        self._tracker = tracker
        self._tracked_agent_name = agent_name
        self._tracked_model_name = model_name
        self._tracked_pricing_model = pricing_model
        self._tracked_role = role

    async def _invoke(self, **kwargs) -> str:
        """保持 AgentTool 语义不变，并补记 usage/cost。"""

        request = str(kwargs.get("request", ""))

        # stateful=False 时，官方语义是每次 fork 一份独立记忆分支。
        agent = self._agent if self._stateful else self._agent.fork()

        if self._max_steps_override is not None:
            agent.max_steps = self._max_steps_override

        usage_before = deepcopy(agent.usage)
        result = await agent(request)
        usage_after = agent.usage
        delta_usage = diff_usage(usage_before, usage_after)

        self._tracker.record_delta(
            agent_name=self._tracked_agent_name,
            model_name=self._tracked_model_name,
            pricing_model=self._tracked_pricing_model,
            role=self._tracked_role,
            stateful=self._stateful,
            delta_usage=delta_usage,
        )

        if self._output_extractor is not None:
            result = self._output_extractor(result)

        return result if isinstance(result, str) else json.dumps(result, ensure_ascii=False)
