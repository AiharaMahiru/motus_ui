from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class MemoryConfig(BaseModel):
    """统一的会话 memory 配置。"""

    type: Literal["basic", "compact"] = "compact"
    compact_model_name: str | None = Field(default="gpt-5.4 mini", description="compact 模式下用于压缩的模型")
    safety_ratio: float = Field(default=0.5, gt=0, le=1, description="compact 模式下的安全阈值比例")
    token_threshold: int | None = Field(default=256000, ge=1, description="compact 模式下触发压缩的 token 阈值")
    max_tool_result_tokens: int = Field(default=50000, ge=1, description="memory 中单条工具输出的保留 token 上限")
    tool_result_truncation_suffix: str = Field(
        default="\n\n... [content truncated due to length]",
        description="工具输出被截断时追加的后缀",
    )
