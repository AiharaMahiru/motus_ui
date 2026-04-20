from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from motus.models import ChatMessage
from .guardrails import GuardrailRule, ToolGuardrailConfig
from .memory import MemoryConfig
from .model_client import ModelClientConfig
from .multi_agent import AgentMetrics, MultiAgentConfig
from .mcp import McpServerConfig
from .response_format import ResponseFormatConfig
from .sandbox import SandboxConfig
from .thinking import ThinkingConfig


class InterruptInfo(BaseModel):
    """统一的中断信息。

    这个模型故意与 motus.serve 的返回结构保持接近，方便本地 backend
    和远端 HITL backend 共用同一套 UI 展示。
    """

    interrupt_id: str
    type: str
    payload: dict[str, Any]
    resumable: bool = True
    resume_blocked_reason: str | None = None


class SessionCreateRequest(BaseModel):
    title: str | None = None
    system_prompt: str = "你是一个可靠的中文助理。回答简洁、准确，必要时优先调用工具。"
    provider: Literal["openai", "anthropic", "gemini", "openrouter"] = "openai"
    model_name: str = "gpt-5.4"
    model_client: ModelClientConfig = Field(default_factory=ModelClientConfig)
    pricing_model: str | None = None
    cache_policy: Literal["none", "static", "auto", "auto_1h"] = "auto"
    max_steps: int = 1024
    timeout_seconds: float | None = 600.0
    thinking: ThinkingConfig = Field(default_factory=ThinkingConfig)
    enabled_tools: list[str] = Field(default_factory=list)
    mcp_servers: list[McpServerConfig] = Field(default_factory=list)
    multi_agent: MultiAgentConfig = Field(default_factory=MultiAgentConfig)
    sandbox: SandboxConfig = Field(default_factory=SandboxConfig)
    human_in_the_loop: bool = False
    approval_tool_names: list[str] = Field(default_factory=list)
    input_guardrails: list[GuardrailRule] = Field(default_factory=list)
    output_guardrails: list[GuardrailRule] = Field(default_factory=list)
    tool_guardrails: list[ToolGuardrailConfig] = Field(default_factory=list)
    response_format: ResponseFormatConfig = Field(default_factory=ResponseFormatConfig)
    memory: MemoryConfig = Field(default_factory=MemoryConfig)


class SessionUpdateRequest(BaseModel):
    """会话配置更新请求。

    这里使用可选字段表达局部更新，便于 API、桌面端和其他 UI 共用同一套后端契约。
    """

    title: str | None = None
    system_prompt: str | None = None
    provider: Literal["openai", "anthropic", "gemini", "openrouter"] | None = None
    model_name: str | None = None
    model_client: ModelClientConfig | None = None
    pricing_model: str | None = None
    cache_policy: Literal["none", "static", "auto", "auto_1h"] | None = None
    max_steps: int | None = Field(default=None, ge=1)
    timeout_seconds: float | None = Field(default=None, gt=0)
    thinking: ThinkingConfig | None = None
    enabled_tools: list[str] | None = None
    mcp_servers: list[McpServerConfig] | None = None
    multi_agent: MultiAgentConfig | None = None
    sandbox: SandboxConfig | None = None
    human_in_the_loop: bool | None = None
    approval_tool_names: list[str] | None = None
    input_guardrails: list[GuardrailRule] | None = None
    output_guardrails: list[GuardrailRule] | None = None
    tool_guardrails: list[ToolGuardrailConfig] | None = None
    response_format: ResponseFormatConfig | None = None
    memory: MemoryConfig | None = None


class SessionSummary(BaseModel):
    session_id: str
    title: str | None = None
    status: Literal["idle", "running", "interrupted", "error"]
    model_name: str
    created_at: str
    updated_at: str
    message_count: int
    total_usage: dict[str, Any]
    total_cost_usd: float | None = None
    last_error: str | None = None
    multi_agent_enabled: bool = False
    specialist_count: int = 0
    project_root: str | None = None
    trace_log_dir: str | None = None


class SessionDetail(SessionSummary):
    system_prompt: str
    provider: Literal["openai", "anthropic", "gemini", "openrouter"] = "openai"
    model_client: ModelClientConfig = Field(default_factory=ModelClientConfig)
    pricing_model: str | None = None
    cache_policy: Literal["none", "static", "auto", "auto_1h"] = "auto"
    max_steps: int
    timeout_seconds: float | None = None
    thinking: ThinkingConfig
    enabled_tools: list[str]
    mcp_servers: list[McpServerConfig] = Field(default_factory=list)
    multi_agent: MultiAgentConfig
    sandbox: SandboxConfig = Field(default_factory=SandboxConfig)
    human_in_the_loop: bool = False
    approval_tool_names: list[str] = Field(default_factory=list)
    input_guardrails: list[GuardrailRule] = Field(default_factory=list)
    output_guardrails: list[GuardrailRule] = Field(default_factory=list)
    tool_guardrails: list[ToolGuardrailConfig] = Field(default_factory=list)
    response_format: ResponseFormatConfig = Field(default_factory=ResponseFormatConfig)
    memory: MemoryConfig = Field(default_factory=MemoryConfig)
    context_window: dict[str, Any]
    last_response: ChatMessage | None = None
    interrupts: list[InterruptInfo] | None = None
    resume_supported: bool = False
    resume_blocked_reason: str | None = None


class MessageRequest(BaseModel):
    role: Literal["system", "user", "assistant", "tool"] = "user"
    content: Any = ""
    user_params: dict[str, Any] | None = None
    base64_image: str | None = None
    webhook: dict[str, Any] | None = None
    model_config = ConfigDict(extra="allow")


class SessionMessageDeleteRequest(BaseModel):
    indices: list[int] = Field(default_factory=list, min_length=1)


class SessionMessageDeleteResponse(BaseModel):
    session_id: str
    deleted_count: int
    message_count: int
    updated_at: str


class InterruptResumeRequest(BaseModel):
    """恢复 HITL interrupt 的统一请求体。"""

    interrupt_id: str
    value: dict[str, Any] = Field(default_factory=dict)


class TurnMetrics(BaseModel):
    turn_usage: dict[str, Any]
    session_usage: dict[str, Any]
    turn_cost_usd: float | None = None
    session_cost_usd: float | None = None
    context_window: dict[str, Any]
    agent_metrics: list[AgentMetrics] = Field(default_factory=list)


class MessageResponse(BaseModel):
    session_id: str
    assistant: ChatMessage | None = None
    metrics: TurnMetrics | None = None
    status: Literal["idle", "running", "interrupted", "error"] = "idle"
    error: str | None = None
    interrupts: list[InterruptInfo] | None = None


@dataclass
class ChatTurnResult:
    assistant: ChatMessage
    metrics: TurnMetrics


class PersistedAgentUsageLedger(BaseModel):
    """持久化到磁盘的子代理 usage 台账。"""

    agent_name: str
    model_name: str
    pricing_model: str | None = None
    role: str
    stateful: bool = False
    session_usage: dict[str, Any] = Field(default_factory=dict)
    session_cost_usd: float | None = 0.0


class SessionManifest(BaseModel):
    """项目级 session manifest。

    `conversation_logs/*.jsonl` 负责恢复聊天消息，
    这里额外补足 UI 和后端继续恢复时需要的结构化元数据。
    """

    session_id: str
    created_at: str
    updated_at: str
    archived: bool = False
    status: Literal["idle", "running", "interrupted", "error"] = "idle"
    config: SessionCreateRequest
    last_error: str | None = None
    last_response: ChatMessage | None = None
    root_usage: dict[str, Any] = Field(default_factory=dict)
    specialist_ledgers: list[PersistedAgentUsageLedger] = Field(default_factory=list)
