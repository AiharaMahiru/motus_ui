from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class ThinkingConfig(BaseModel):
    """统一的思考配置。

    这个模型被会话配置和子代理配置共同复用，避免多处重复定义后出现字段漂移。
    """

    enabled: bool = True
    effort: Literal["minimal", "low", "medium", "high", "xhigh"] | None = "medium"
    verbosity: Literal["low", "medium", "high"] | None = "medium"
    budget_tokens: int | None = None
