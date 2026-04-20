from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from .mcp import McpServerConfig
from .thinking import ThinkingConfig


class OutputExtractorConfig(BaseModel):
    """声明式子代理输出提取器。"""

    mode: Literal["full", "json", "field"] = Field(
        default="full",
        description="full 返回完整结果，json 解析为结构，field 按路径抽取字段",
    )
    field_path: str | None = Field(default=None, description="field 模式下使用 a.b.c 形式路径")

    @model_validator(mode="after")
    def validate_mode(self) -> "OutputExtractorConfig":
        if self.mode == "field" and not self.field_path:
            raise ValueError("field 模式必须提供 field_path")
        if self.mode != "field" and self.field_path is not None:
            raise ValueError("只有 field 模式可以提供 field_path")
        return self


class SpecialistAgentConfig(BaseModel):
    """单个专家子代理的声明式配置。"""

    name: str = Field(..., min_length=1, description="子代理名称，用于事件流和默认工具名")
    description: str = Field(..., min_length=1, description="暴露给主管 agent 的工具描述")
    tool_name: str | None = Field(default=None, description="可选，覆盖暴露给主管的工具名")
    system_prompt: str | None = Field(default=None, description="子代理专属 system prompt")
    provider: Literal["openai", "anthropic", "gemini", "openrouter"] | None = Field(
        default=None,
        description="默认继承父级 provider",
    )
    model_name: str | None = Field(default=None, description="默认继承父级模型")
    pricing_model: str | None = Field(default=None, description="可选，覆盖成本统计使用的定价模型")
    max_steps: int | None = Field(default=None, ge=1, description="子代理自身的推理步数上限")
    tool_max_steps: int | None = Field(default=None, ge=1, description="作为工具被调用时的步数上限")
    timeout_seconds: float | None = Field(default=None, gt=0, description="默认继承父级超时")
    thinking: ThinkingConfig | None = Field(default=None, description="默认继承父级思考配置")
    enabled_tools: list[str] | None = Field(default=None, description="默认继承父级启用工具")
    mcp_servers: list[McpServerConfig] | None = Field(default=None, description="默认继承父级 MCP 配置")
    stateful: bool = Field(default=False, description="是否在一次会话中持续保留子代理记忆")
    output_extractor: OutputExtractorConfig | None = Field(
        default=None,
        description="可选，压缩或抽取子代理结果后再返回给主管",
    )
    specialists: list["SpecialistAgentConfig"] = Field(
        default_factory=list,
        description="可选，允许构造多层主管/专家树",
    )

    @model_validator(mode="after")
    def validate_nested_specialists(self) -> "SpecialistAgentConfig":
        tool_names: set[str] = set()
        for specialist in self.specialists:
            tool_name = specialist.tool_name or specialist.name
            if tool_name in tool_names:
                raise ValueError(f"子代理 {self.name} 下存在重复工具名: {tool_name}")
            tool_names.add(tool_name)
        return self


class MultiAgentConfig(BaseModel):
    """主管/专家多代理配置。"""

    supervisor_name: str = Field(default="assistant", min_length=1, description="主管 agent 名称")
    specialists: list[SpecialistAgentConfig] = Field(default_factory=list, description="主管可调用的专家子代理列表")

    @model_validator(mode="after")
    def validate_specialists(self) -> "MultiAgentConfig":
        """校验同一主管下的工具名不冲突。

        Motus 会把子代理暴露成普通工具，所以这里必须保证兄弟节点的工具名唯一。
        """

        tool_names: set[str] = set()
        for specialist in self.specialists:
            tool_name = specialist.tool_name or specialist.name
            if tool_name in tool_names:
                raise ValueError(f"重复的子代理工具名: {tool_name}")
            tool_names.add(tool_name)
        return self

    def enabled(self) -> bool:
        return bool(self.specialists)

    def specialist_count(self) -> int:
        def count(items: list[SpecialistAgentConfig]) -> int:
            return sum(1 + count(item.specialists) for item in items)

        return count(self.specialists)


class AgentMetrics(BaseModel):
    """单个 agent 的 usage/cost 明细。

    多代理场景下，总 usage 仍然保留聚合值，但前端或其他 UI 平台通常还需要
    看每个主管/专家的单独消耗，所以这里补一份按 agent 维度的细分。
    """

    agent_name: str
    role: Literal["supervisor", "specialist"]
    model_name: str
    pricing_model: str | None = None
    stateful: bool = False
    turn_usage: dict[str, Any] = Field(default_factory=dict)
    session_usage: dict[str, Any] = Field(default_factory=dict)
    turn_cost_usd: float | None = None
    session_cost_usd: float | None = None
