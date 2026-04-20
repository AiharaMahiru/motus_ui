from __future__ import annotations

import asyncio
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any
import uuid

from motus.models import ChatMessage

from core.agents.factory import create_react_agent
from core.agents.multi_agent import MultiAgentUsageTracker
from core.memory.store import setup_memory
from core.schemas.session import PersistedAgentUsageLedger, SessionCreateRequest
from core.servers.hitl_telemetry import seed_agent_usage
from core.visualization import (
    DataAnalysisWorkflowService,
    VisualizationPolicyService,
    VisualizationProtocolService,
    VisualizationRewriteService,
)
from .state import ChatSessionStateMixin
from .storage import ChatSessionStorageMixin
from .title import SessionTitleService
from .turn import ChatSessionTurnMixin
from .utils import utc_now_iso


@dataclass
class ChatSession(
    ChatSessionTurnMixin,
    ChatSessionStateMixin,
    ChatSessionStorageMixin,
):
    session_id: str
    config: SessionCreateRequest
    agent: Any
    created_at: str
    updated_at: str
    status: str = "idle"
    last_error: str | None = None
    last_response: ChatMessage | None = None
    specialist_usage_tracker: MultiAgentUsageTracker = field(
        default_factory=MultiAgentUsageTracker,
        repr=False,
    )
    title_service: SessionTitleService | None = field(default=None, repr=False)
    data_analysis_service: DataAnalysisWorkflowService = field(
        default_factory=DataAnalysisWorkflowService,
        repr=False,
    )
    visualization_policy_service: VisualizationPolicyService = field(
        default_factory=VisualizationPolicyService,
        repr=False,
    )
    visualization_protocol_service: VisualizationProtocolService = field(
        default_factory=VisualizationProtocolService,
        repr=False,
    )
    visualization_rewrite_service: VisualizationRewriteService = field(
        default_factory=VisualizationRewriteService,
        repr=False,
    )
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, repr=False)
    _event_queue: asyncio.Queue[dict[str, Any]] | None = field(default=None, repr=False)
    _turn_usage_baseline: dict[str, Any] = field(default_factory=dict, repr=False)
    _session_cost_baseline_usd: float | None = field(default=None, repr=False)
    _active_turn_task: asyncio.Task[Any] | None = field(default=None, repr=False)
    _turn_started_monotonic: float | None = field(default=None, repr=False)
    _last_activity_monotonic: float | None = field(default=None, repr=False)

    def _build_agent(
        self,
        *,
        config: SessionCreateRequest,
        memory: Any | None = None,
        root_usage: dict[str, Any] | None = None,
        specialist_ledgers: list[PersistedAgentUsageLedger] | None = None,
    ) -> None:
        """按当前配置重建 agent，同时尽量保留既有会话状态。"""

        if config.human_in_the_loop or config.approval_tool_names:
            raise RuntimeError("本地会话 backend 不支持 interrupt/resume；请切换到 HITL backend 再启用审批或 ask_user_question")

        memory = memory or setup_memory(session_id=self.session_id, settings=config.memory)
        specialist_usage_tracker = MultiAgentUsageTracker()

        async def on_step(agent_name: str, content: str | None, tool_calls: list[dict]) -> None:
            if self._event_queue is None:
                return
            self._mark_turn_activity()
            session_usage = self.aggregate_usage()
            from core.llm.costs import diff_usage

            turn_usage = diff_usage(self._turn_usage_baseline, session_usage)
            session_cost = self.aggregate_total_cost()
            if session_cost is None or self._session_cost_baseline_usd is None:
                turn_cost = None
            else:
                turn_cost = max(session_cost - self._session_cost_baseline_usd, 0.0)
            await self._event_queue.put(
                {
                    "event": "assistant.step",
                    "data": {
                        "session_id": self.session_id,
                        "agent_name": agent_name,
                        "content": content,
                        "tool_calls": tool_calls,
                        "turn_usage": turn_usage,
                        "session_usage": session_usage,
                        "turn_cost_usd": turn_cost,
                        "session_cost_usd": session_cost,
                        "timestamp": utc_now_iso(),
                    },
                }
            )

        def build_memory(agent_path: str) -> Any:
            """为每个子代理分配独立 memory。"""

            normalized = agent_path.replace("/", "__")
            return setup_memory(
                session_id=f"{self.session_id}::{normalized}",
                settings=config.memory,
            )

        self.config = config
        self.specialist_usage_tracker = specialist_usage_tracker
        self.agent = create_react_agent(
            agent_name=config.multi_agent.supervisor_name,
            system_prompt=config.system_prompt,
            provider=config.provider,
            model_name=config.model_name,
            cache_policy=config.cache_policy,
            model_client=config.model_client,
            enabled_tools=list(config.enabled_tools),
            max_steps=config.max_steps,
            timeout_seconds=config.timeout_seconds,
            memory_type=config.memory.type,
            thinking_enabled=config.thinking.enabled,
            thinking_effort=config.thinking.effort,
            thinking_verbosity=config.thinking.verbosity,
            thinking_budget_tokens=config.thinking.budget_tokens,
            memory=memory,
            step_callback=on_step,
            session_scoped_todo=True,
            human_in_the_loop=config.human_in_the_loop,
            approval_tool_names=set(config.approval_tool_names),
            mcp_servers=config.mcp_servers,
            sandbox_config=config.sandbox,
            input_guardrails=config.input_guardrails,
            output_guardrails=config.output_guardrails,
            tool_guardrails=config.tool_guardrails,
            response_format_config=config.response_format,
            multi_agent=config.multi_agent,
            specialist_usage_tracker=specialist_usage_tracker,
            memory_factory=build_memory,
            agent_path=config.multi_agent.supervisor_name,
        )

        if root_usage:
            seed_agent_usage(self.agent, root_usage)
        if specialist_ledgers:
            self.specialist_usage_tracker.load_state(
                [ledger.model_dump(exclude_none=False) for ledger in specialist_ledgers]
            )

    @classmethod
    def create(
        cls,
        config: SessionCreateRequest,
        session_id: str | None = None,
        *,
        created_at: str | None = None,
        updated_at: str | None = None,
        status: str = "idle",
        last_error: str | None = None,
        last_response: ChatMessage | None = None,
        root_usage: dict[str, Any] | None = None,
        specialist_ledgers: list[PersistedAgentUsageLedger] | None = None,
        title_service: SessionTitleService | None = None,
        data_analysis_service: DataAnalysisWorkflowService | None = None,
        visualization_policy_service: VisualizationPolicyService | None = None,
        visualization_protocol_service: VisualizationProtocolService | None = None,
        visualization_rewrite_service: VisualizationRewriteService | None = None,
    ) -> "ChatSession":
        session_id = session_id or str(uuid.uuid4())
        timestamp = created_at or utc_now_iso()
        memory = setup_memory(session_id=session_id, settings=config.memory)
        specialist_usage_tracker = MultiAgentUsageTracker()
        resolved_data_analysis_service = data_analysis_service or DataAnalysisWorkflowService()
        resolved_visualization_policy_service = visualization_policy_service or VisualizationPolicyService()
        resolved_visualization_protocol_service = visualization_protocol_service or VisualizationProtocolService()
        resolved_visualization_rewrite_service = visualization_rewrite_service or VisualizationRewriteService(
            protocol_service=resolved_visualization_protocol_service
        )

        session = cls(
            session_id=session_id,
            config=config,
            created_at=timestamp,
            updated_at=updated_at or timestamp,
            status=status,
            agent=None,  # type: ignore[arg-type]
            last_error=last_error,
            last_response=last_response,
            specialist_usage_tracker=specialist_usage_tracker,
            title_service=title_service,
            data_analysis_service=resolved_data_analysis_service,
            visualization_policy_service=resolved_visualization_policy_service,
            visualization_protocol_service=resolved_visualization_protocol_service,
            visualization_rewrite_service=resolved_visualization_rewrite_service,
        )
        session._build_agent(
            config=config,
            memory=memory,
            root_usage=root_usage,
            specialist_ledgers=specialist_ledgers,
        )
        return session
