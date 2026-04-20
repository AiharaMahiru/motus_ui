from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ModelClientConfig(BaseModel):
    """会话级模型客户端覆盖配置。

    不直接存原始密钥，只允许引用环境变量名，避免把敏感信息写进会话配置或日志。
    """

    base_url: str | None = Field(default=None, description="会话级模型网关地址覆盖")
    api_key_env_var: str | None = Field(default=None, description="会话级 API Key 环境变量名")
    mode: Literal["inherit", "override"] = Field(
        default="inherit",
        description="inherit 走全局环境变量，override 启用会话级覆盖",
    )

    def enabled(self) -> bool:
        return self.mode == "override" and bool(self.base_url or self.api_key_env_var)
