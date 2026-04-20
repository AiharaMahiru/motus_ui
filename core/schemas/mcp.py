from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from .sandbox import SandboxConfig


class McpServerConfig(BaseModel):
    """统一的 MCP 配置模型。"""

    name: str = Field(..., description="MCP 配置名称，用于日志与区分来源。")
    transport: Literal["remote_http", "local_stdio"] = Field(
        ...,
        description="远端 HTTP MCP 或本地 stdio MCP。",
    )
    url: str | None = Field(default=None, description="远端 MCP HTTP 地址。")
    command: str | None = Field(default=None, description="本地 stdio MCP 启动命令。")
    args: list[str] = Field(default_factory=list, description="本地 stdio MCP 启动参数。")
    env: dict[str, str] = Field(default_factory=dict, description="本地 stdio MCP 环境变量。")
    headers: dict[str, str] = Field(default_factory=dict, description="远端 HTTP MCP 请求头。")
    prefix: str = Field(default="", description="暴露到 agent 内的工具名前缀。")
    allowlist: list[str] = Field(default_factory=list, description="允许暴露的方法名列表。")
    blocklist: list[str] = Field(default_factory=list, description="禁止暴露的方法名列表。")
    method_aliases: dict[str, str] = Field(default_factory=dict, description="方法名到工具名的别名映射。")
    image: str | None = Field(default=None, description="若需在 sandbox 内启动 MCP server，可指定镜像。")
    port: int = Field(default=8080, ge=1, le=65535, description="sandbox MCP server 对外监听的容器端口。")
    sandbox_path: str = Field(default="/mcp", description="sandbox 模式下 MCP HTTP 路径。")
    sandbox: SandboxConfig | None = Field(default=None, description="可选，指定 sandbox 运行时。")

    @model_validator(mode="after")
    def validate_transport_fields(self):
        if self.transport == "remote_http":
            if not self.url:
                raise ValueError("remote_http 模式必须提供 url")
            if self.command:
                raise ValueError("remote_http 模式不能同时提供 command")
        if self.transport == "local_stdio":
            if not self.command:
                raise ValueError("local_stdio 模式必须提供 command")
        if self.image and self.transport != "local_stdio":
            raise ValueError("image 仅适用于 local_stdio MCP")
        return self
