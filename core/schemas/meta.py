from __future__ import annotations

from pydantic import BaseModel


class AppMeta(BaseModel):
    """面向 WebUI / 桌面壳的运行时元信息。"""

    app_version: str
    desktop_mode: bool
    backend_mode: str
    api_base_url: str
    runtime_dir: str
    project_root: str
    server_started_at: str
    supports_interrupts: bool = False
    supports_dynamic_session_config: bool = True
    supports_preview: bool = True
    supports_structured_response_format: bool = False
