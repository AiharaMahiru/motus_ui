from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class SandboxConfig(BaseModel):
    """统一的 sandbox 配置。

    当前后端优先支持：
    - local: 使用 Motus LocalShell
    - docker: 使用 Motus DockerSandbox，并可自动挂载项目目录
    - cloud: 使用 Motus CloudSandbox
    """

    provider: Literal["local", "docker", "cloud"] = "local"
    cwd: str | None = Field(default=None, description="local 模式下的工作目录，默认项目根目录")
    image: str | None = Field(default=None, description="docker 模式镜像；未提供时走 SDK 默认值")
    cloud_url: str | None = Field(default=None, description="cloud 模式的 sandbox URL")
    token_env_var: str | None = Field(default=None, description="cloud 模式下读取 token 的环境变量名")
    env: dict[str, str] = Field(default_factory=dict, description="sandbox 级环境变量")
    mount_project_root: bool = Field(default=True, description="docker 模式是否把项目根目录挂载进沙箱")
    mount_path: str = Field(default="/workspace", description="docker 模式下项目目录挂载到容器内的位置")
    restrict_file_tools_to_workspace: bool = Field(
        default=True,
        description="是否把 read/write/edit_file 限制在工作区根目录内",
    )
