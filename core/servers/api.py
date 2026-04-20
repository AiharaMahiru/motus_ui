from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.backends.base import SessionBackend
from core.backends.factory import create_backend
from core.backends.local import LocalSessionBackend
from core.chat import ChatService, ToolMessageSummaryService
from core.config.env import load_project_env
from core.preview import PreviewService
from core.services.system import SystemService
from core.services.tracing import TracingService
from core.servers.api_context import ApiServices
from core.servers.api_routes import (
    create_preview_router,
    create_session_router,
    create_system_router,
    create_tool_message_router,
    create_workflow_router,
)
from core.workflows import WorkflowService


load_project_env()


def _resolve_cors_origins() -> list[str]:
    """解析允许的跨域来源。"""

    raw = os.getenv("APP_CORS_ORIGINS", "").strip()
    if raw:
        return [item.strip() for item in raw.split(",") if item.strip()]
    return [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    ]


def _resolve_session_backend(
    service: ChatService | None,
    session_backend: SessionBackend | None,
) -> tuple[SessionBackend, ChatService | None]:
    """构造统一会话 backend，并尽量保留本地 ChatService 给 preview 等能力复用。"""

    if session_backend is not None:
        if isinstance(session_backend, LocalSessionBackend):
            return session_backend, session_backend.service
        return session_backend, service

    if service is not None:
        service.restore_sessions()
        backend = LocalSessionBackend(service)
        return backend, service

    backend = create_backend(
        mode=os.getenv("APP_BACKEND_MODE", "local"),
        hitl_url=os.getenv("APP_HITL_BASE_URL", "http://127.0.0.1:8001"),
    )
    if isinstance(backend, LocalSessionBackend):
        return backend, backend.service
    return backend, None


def create_app(
    service: ChatService | None = None,
    *,
    session_backend: SessionBackend | None = None,
) -> FastAPI:
    resolved_backend, chat_service = _resolve_session_backend(service, session_backend)
    services = ApiServices(
        session_backend=resolved_backend,
        chat_service=chat_service,
        system_service=SystemService(),
        tracing_service=TracingService(),
        workflow_service=WorkflowService(),
        tool_message_summary_service=ToolMessageSummaryService(),
        preview_service=PreviewService(),
    )
    meta = services.system_service.get_app_meta()

    app = FastAPI(title="Motus Agent Project", version=meta.app_version)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_resolve_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(create_system_router(services))
    app.include_router(create_session_router(services))
    app.include_router(create_preview_router(services))
    app.include_router(create_tool_message_router(services))
    app.include_router(create_workflow_router(services))

    aclose = getattr(resolved_backend, "aclose", None)
    if callable(aclose):
        async def _close_backend_client() -> None:
            await aclose()

        app.add_event_handler("shutdown", _close_backend_client)

    return app


app = create_app()
