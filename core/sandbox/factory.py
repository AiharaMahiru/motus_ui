from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

from motus.tools.providers.local import LocalShell

from core.config.paths import PROJECT_ROOT
from core.schemas.sandbox import SandboxConfig


@dataclass(frozen=True)
class SandboxRuntime:
    """解析后的 sandbox 运行时对象。

    `workspace_root` 用于文件工具 guardrail 和 UI 展示；
    `sandbox` 则直接传给 Motus builtin tools / MCP session。
    """

    sandbox: Any
    workspace_root: str


def _project_root_str() -> str:
    return str(PROJECT_ROOT)


def build_sandbox_runtime(config: SandboxConfig | None = None) -> SandboxRuntime:
    """根据声明式配置构造 Motus sandbox。"""

    resolved = config or SandboxConfig()

    if resolved.provider == "local":
        cwd = resolved.cwd or _project_root_str()
        return SandboxRuntime(
            sandbox=LocalShell(cwd=cwd),
            workspace_root=cwd,
        )

    if resolved.provider == "docker":
        from motus.tools.providers.docker.sandbox import DockerSandbox

        workspace_root = resolved.mount_path if resolved.mount_project_root else "/workspace"
        mounts = {str(PROJECT_ROOT): resolved.mount_path} if resolved.mount_project_root else None
        sandbox = DockerSandbox.create(
            image=resolved.image or "python:3.12",
            env=resolved.env or None,
            mounts=mounts,
        )
        return SandboxRuntime(
            sandbox=sandbox,
            workspace_root=workspace_root,
        )

    if resolved.provider == "cloud":
        from motus.tools.providers.cloud.sandbox import CloudSandbox

        token = os.getenv(resolved.token_env_var) if resolved.token_env_var else None
        sandbox = CloudSandbox(
            url=resolved.cloud_url,
            token=token,
        )
        return SandboxRuntime(
            sandbox=sandbox,
            workspace_root=resolved.cwd or "/workspace",
        )

    raise ValueError(f"未知 sandbox provider: {resolved.provider}")
