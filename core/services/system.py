from __future__ import annotations

import os
from datetime import datetime, timezone
from importlib import metadata

from core.config.paths import PROJECT_ROOT, RUNTIME_DIR
from core.runtime_catalog import collect_runtime_checks
from core.schemas.meta import AppMeta
from core.schemas.runtime import RuntimeCheckSummary, RuntimeRequirementSummary, RuntimeRequirementsResponse


def utc_now_iso() -> str:
    """统一生成 UTC ISO 时间字符串。"""

    return datetime.now(timezone.utc).isoformat()


def _resolve_app_version() -> str:
    """优先从环境变量或已安装包读取版本，失败时退回默认值。"""

    env_version = os.getenv("APP_VERSION")
    if env_version:
        return env_version
    try:
        return metadata.version("agent")
    except metadata.PackageNotFoundError:
        return "0.1.0"


def _resolve_api_base_url() -> str:
    """根据当前服务监听配置生成推荐的 API base URL。"""

    explicit_base_url = os.getenv("APP_BASE_URL")
    if explicit_base_url:
        return explicit_base_url.rstrip("/")

    host = os.getenv("APP_HOST", "127.0.0.1").strip()
    port = os.getenv("APP_PORT", "8000").strip()
    normalized_host = "127.0.0.1" if host in {"0.0.0.0", "::", ""} else host
    return f"http://{normalized_host}:{port}"


def _resolve_backend_mode() -> str:
    return os.getenv("APP_BACKEND_MODE", "local").strip().lower() or "local"


class SystemService:
    """统一提供面向 UI 的只读系统信息。"""

    def __init__(self, *, server_started_at: str | None = None) -> None:
        self.server_started_at = server_started_at or utc_now_iso()

    def get_app_meta(self) -> AppMeta:
        """返回当前服务的元信息。"""

        return AppMeta(
            app_version=_resolve_app_version(),
            desktop_mode=os.getenv("APP_DESKTOP_MODE", "0") == "1",
            backend_mode=_resolve_backend_mode(),
            api_base_url=_resolve_api_base_url(),
            runtime_dir=str(RUNTIME_DIR),
            project_root=str(PROJECT_ROOT),
            server_started_at=self.server_started_at,
            supports_interrupts=_resolve_backend_mode() == "hitl",
            # 当前 HITL 后端已经支持 session 级 GET/PUT/PATCH/DELETE 配置。
            supports_dynamic_session_config=True,
            supports_preview=_resolve_backend_mode() == "local",
            supports_structured_response_format=True,
        )

    def get_runtime_requirements(self) -> RuntimeRequirementsResponse:
        """返回运行时依赖检测总览。"""

        checks = [
            RuntimeCheckSummary(
                requirement=RuntimeRequirementSummary(
                    key=item.requirement.key,
                    label=item.requirement.label,
                    category=item.requirement.category,
                    requirement_type=item.requirement.requirement_type,
                    summary=item.requirement.summary,
                    install_hint=item.requirement.install_hint,
                    required_by=list(item.requirement.required_by),
                    notes=list(item.requirement.notes),
                    binaries=list(item.requirement.binaries),
                    env_vars=list(item.requirement.env_vars),
                    modules=list(item.requirement.modules),
                    files=list(item.requirement.files),
                    manual=item.requirement.manual,
                ),
                status=item.status,
                detail=item.detail,
            )
            for item in collect_runtime_checks()
        ]
        ready_count = sum(1 for item in checks if item.status == "ready")
        missing_count = sum(1 for item in checks if item.status == "missing")
        manual_count = sum(1 for item in checks if item.status == "manual")

        return RuntimeRequirementsResponse(
            generated_at=utc_now_iso(),
            project_root=str(PROJECT_ROOT),
            ready_count=ready_count,
            missing_count=missing_count,
            manual_count=manual_count,
            checks=checks,
        )
