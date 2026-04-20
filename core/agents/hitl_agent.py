from __future__ import annotations

import logging
import os
import uuid

from motus.models import ChatMessage
from motus.memory import BasicMemory, CompactionMemory, CompactionMemoryConfig

from core.agents.factory import ALL_HITL_TOOL_NAMES, create_react_agent
from core.agents.multi_agent import MultiAgentUsageTracker
from core.agents.hitl_config import load_hitl_session_config
from core.config.env import load_project_env
from core.schemas.memory import MemoryConfig
from core.schemas.mcp import McpServerConfig
from core.schemas.session import SessionCreateRequest
from core.servers.hitl_telemetry import HitlTelemetryTracker


load_project_env()

logger = logging.getLogger(__name__)


HITL_MODEL_NAME = os.getenv("HITL_MODEL_NAME", "gpt-5.4")
HITL_SYSTEM_PROMPT = os.getenv(
    "HITL_SYSTEM_PROMPT",
    (
        "你是一个支持人在回路的中文助理。"
        "当任务存在歧义、需要用户偏好、需要用户确认危险操作，"
        "或者工具执行可能修改文件/系统状态时，主动触发 ask_user_question 或等待 tool approval。"
    ),
)
HITL_TIMEOUT_SECONDS = float(os.getenv("HITL_TIMEOUT_SECONDS", "0") or "0") or None


def load_hitl_mcp_servers() -> list[McpServerConfig]:
    """从环境变量加载静态 MCP 配置。

    当前提供一个最小入口：
    - `HITL_REMOTE_MCP_URL`
    - `HITL_LOCAL_MCP_COMMAND`
    - `HITL_LOCAL_MCP_ARGS` 以空格分隔
    """

    servers: list[McpServerConfig] = []
    remote_url = os.getenv("HITL_REMOTE_MCP_URL")
    if remote_url:
        servers.append(
            McpServerConfig(
                name="remote-mcp",
                transport="remote_http",
                url=remote_url,
            )
        )

    local_command = os.getenv("HITL_LOCAL_MCP_COMMAND")
    if local_command:
        servers.append(
            McpServerConfig(
                name="local-mcp",
                transport="local_stdio",
                command=local_command,
                args=os.getenv("HITL_LOCAL_MCP_ARGS", "").split(),
            )
        )
    return servers


def default_hitl_session_config() -> SessionCreateRequest:
    """生成 HITL 会话的默认配置。

    这份默认值既用于未显式配置的 session，也用于服务器端动态 patch 的兜底基线。
    """

    return SessionCreateRequest(
        system_prompt=HITL_SYSTEM_PROMPT,
        provider="openai",
        model_name=HITL_MODEL_NAME,
        cache_policy="auto",
        enabled_tools=list(ALL_HITL_TOOL_NAMES),
        max_steps=1024,
        timeout_seconds=HITL_TIMEOUT_SECONDS,
        mcp_servers=load_hitl_mcp_servers(),
        human_in_the_loop=True,
        approval_tool_names=["bash", "write_file", "edit_file"],
    )


class HitlSessionServableAgent:
    """按 session 动态构建 agent 的 HITL 包装器。

    Motus AgentServer 只负责保存会话 state，不支持把复杂配置直接挂到 session。
    这里通过 `MOTUS_SESSION_ID` 读取当前会话 ID，再从 runtime/hitl_sessions 读取
    该 session 的完整配置，在每次 turn 开始时重建对应的 ReActAgent。
    """

    def _resolve_session_id(self) -> str:
        return os.getenv("MOTUS_SESSION_ID", "hitl-serve-agent").strip() or "hitl-serve-agent"

    def _resolve_config(self, session_id: str) -> SessionCreateRequest:
        return load_hitl_session_config(session_id) or default_hitl_session_config()

    def _build_transient_memory(self, session_id: str, settings: MemoryConfig):
        """构造仅用于当前 serve worker 的短生命周期 memory。

        HITL turn 会由 AgentServer 传入完整 `state`，不能再从磁盘日志恢复，
        否则会出现“先恢复旧消息，再 replay state”导致历史重复的问题。
        """

        if settings.type == "basic":
            return BasicMemory(
                max_tool_result_tokens=settings.max_tool_result_tokens,
                tool_result_truncation_suffix=settings.tool_result_truncation_suffix,
            )

        return CompactionMemory(
            config=CompactionMemoryConfig(
                session_id=f"{session_id}::hitl::{uuid.uuid4().hex}",
                safety_ratio=settings.safety_ratio,
                token_threshold=settings.token_threshold,
                compact_model_name=settings.compact_model_name,
                max_tool_result_tokens=settings.max_tool_result_tokens,
                tool_result_truncation_suffix=settings.tool_result_truncation_suffix,
            ),
            on_compact=lambda _stats: None,
        )

    def _build_agent(self, session_id: str):
        config = self._resolve_config(session_id)
        specialist_usage_tracker = MultiAgentUsageTracker()
        telemetry_tracker = HitlTelemetryTracker(
            session_id=session_id,
            config=config,
            specialist_usage_tracker=specialist_usage_tracker,
        )
        agent_holder: dict[str, object] = {}

        async def _persist_step_telemetry(
            agent_name: str,
            content: str | None,
            tool_calls: list[dict],
        ) -> None:
            # 这里仅做 sidecar 落盘，不能影响真实对话流程。
            del agent_name, content, tool_calls
            agent = agent_holder.get("agent")
            if agent is None:
                return
            try:
                telemetry_tracker.persist()
            except Exception:
                logger.warning("写入 HITL step telemetry 失败: %s", session_id, exc_info=True)

        agent = create_react_agent(
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
            memory=self._build_transient_memory(session_id, config.memory),
            step_callback=_persist_step_telemetry,
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
            memory_factory=lambda _agent_path: self._build_transient_memory(
                session_id=session_id,
                settings=config.memory,
            ),
            agent_path=config.multi_agent.supervisor_name,
        )
        agent_holder["agent"] = agent
        telemetry_tracker.attach_agent(agent)
        return agent, telemetry_tracker

    async def run_turn(
        self,
        message: ChatMessage,
        state: list[ChatMessage],
    ) -> tuple[ChatMessage, list[ChatMessage]]:
        session_id = self._resolve_session_id()
        agent, telemetry_tracker = self._build_agent(session_id)
        try:
            response, new_state = await agent.run_turn(message, state)
            telemetry_tracker.persist()
            return response, new_state
        except Exception:
            try:
                telemetry_tracker.persist()
            except Exception:
                logger.warning("写入 HITL 异常 telemetry 失败: %s", session_id, exc_info=True)
            raise


def build_hitl_agent() -> HitlSessionServableAgent:
    """构造供 motus serve 使用的 module-level servable agent。"""

    return HitlSessionServableAgent()


agent = build_hitl_agent()
