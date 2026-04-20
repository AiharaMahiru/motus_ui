from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class GuardrailRule(BaseModel):
    """声明式 guardrail 规则。

    Motus 原生 guardrail 接口是 Python callable。这里额外包一层可序列化配置，
    让 WebUI、Tauri 和后端 API 都能共享同一份会话契约，再由 factory 转回 callable。
    """

    kind: Literal["max_length", "deny_regex", "require_regex", "rewrite_regex"]
    message: str | None = Field(default=None, description="触发规则时返回给模型或用户的说明")
    pattern: str | None = Field(default=None, description="正则表达式，适用于 deny/require/rewrite")
    replacement: str | None = Field(default=None, description="rewrite_regex 的替换文本")
    max_length: int | None = Field(default=None, ge=1, description="max_length 规则使用的最大长度")
    ignore_case: bool = Field(default=False, description="是否启用忽略大小写")
    multiline: bool = Field(default=False, description="是否启用多行模式")
    dotall: bool = Field(default=False, description="是否让 . 匹配换行")

    @model_validator(mode="after")
    def validate_fields(self) -> "GuardrailRule":
        if self.kind == "max_length":
            if self.max_length is None:
                raise ValueError("max_length 规则必须提供 max_length")
            return self

        if not self.pattern:
            raise ValueError(f"{self.kind} 规则必须提供 pattern")

        if self.kind == "rewrite_regex" and self.replacement is None:
            raise ValueError("rewrite_regex 规则必须提供 replacement")

        return self


class ToolGuardrailConfig(BaseModel):
    """单个工具的输入/输出 guardrail 配置。"""

    tool_name: str = Field(..., min_length=1, description="要绑定的工具名")
    input_rules: list[GuardrailRule] = Field(default_factory=list, description="作用在工具输入参数上的规则")
    output_rules: list[GuardrailRule] = Field(default_factory=list, description="作用在工具输出结果上的规则")
    path_fields: list[str] = Field(default_factory=list, description="需要作为路径校验的入参字段名")
    require_absolute_paths: bool = Field(default=False, description="是否要求这些路径字段必须为绝对路径")
    allowed_roots: list[str] = Field(default_factory=list, description="允许访问的根目录前缀列表")
