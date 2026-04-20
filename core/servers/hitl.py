from __future__ import annotations

import os

from motus.serve import AgentServer
import uvicorn
from fastapi import HTTPException

from core.agents.hitl_agent import default_hitl_session_config
from core.agents.hitl_config import (
    delete_hitl_session_config,
    load_hitl_session_config,
    save_hitl_session_config,
    update_hitl_session_config,
)
from core.config.env import load_project_env
from core.schemas.session import SessionCreateRequest, SessionDetail, SessionSummary, SessionUpdateRequest, TurnMetrics
from .hitl_runtime import build_hitl_session_detail, build_hitl_session_summary
from .hitl_telemetry import load_hitl_last_turn_metrics
from .hitl_state import PersistentSession, PersistentSessionStore


load_project_env()

class PersistentHitlAgentServer(AgentServer):
    """为 Motus AgentServer 补充会话状态持久化。"""

    def __init__(self, *args, **kwargs):
        ttl = float(kwargs.get("ttl", 0) or 0)
        max_sessions = int(kwargs.get("max_sessions", 0) or 0)
        super().__init__(*args, **kwargs)
        self._sessions = PersistentSessionStore(ttl=ttl, max_sessions=max_sessions)

    async def _run_turn(self, session_id: str, message, *, webhook=None) -> None:  # type: ignore[override]
        session = self._sessions.get(session_id)
        if isinstance(session, PersistentSession):
            session.mark_pending_message(message)
        await super()._run_turn(session_id, message, webhook=webhook)


def build_hitl_server() -> AgentServer:
    """构造独立的 HITL 会话服务器。

    之所以单独走 AgentServer，而不是复用当前 in-process ChatService，
    是因为 Motus 的 interrupt()/resume 机制只能在 serve worker 子进程中工作。
    """

    return PersistentHitlAgentServer(
        "core.agents.hitl_agent:agent",
        max_workers=int(os.getenv("HITL_MAX_WORKERS", "2")),
        ttl=float(os.getenv("HITL_SESSION_TTL", "0")),
        timeout=float(os.getenv("HITL_TURN_TIMEOUT", "0")),
        max_sessions=int(os.getenv("HITL_MAX_SESSIONS", "0")),
        shutdown_timeout=float(os.getenv("HITL_SHUTDOWN_TIMEOUT", "0")),
        allow_custom_ids=True,
    )


def create_hitl_app():
    """为 HITL server 补充会话配置接口。

    底层执行仍交给 Motus AgentServer；这里只额外挂一层 session config 侧车存储，
    让上层 backend 能像本地后端一样创建/更新多代理、tool、MCP 等配置。
    """

    server = build_hitl_server()
    app = server.app

    def _resolve_session_config(session_id: str) -> SessionCreateRequest:
        return load_hitl_session_config(session_id) or default_hitl_session_config()

    @app.get("/backend/sessions", response_model=list[SessionSummary])
    async def list_backend_sessions() -> list[SessionSummary]:
        summaries: list[SessionSummary] = []
        for session in server._sessions.list():
            if not isinstance(session, PersistentSession):
                continue
            summaries.append(
                build_hitl_session_summary(
                    session,
                    _resolve_session_config(session.session_id),
                )
            )
        return sorted(summaries, key=lambda item: item.updated_at, reverse=True)

    @app.get("/backend/sessions/{session_id}", response_model=SessionDetail)
    async def get_backend_session_detail(session_id: str) -> SessionDetail:
        session = server._sessions.get(session_id)
        if not isinstance(session, PersistentSession):
            raise HTTPException(status_code=404, detail="Session not found")
        return build_hitl_session_detail(
            session,
            _resolve_session_config(session_id),
        )

    @app.get("/backend/sessions/{session_id}/turn-metrics", response_model=TurnMetrics | None)
    async def get_backend_session_turn_metrics(session_id: str) -> TurnMetrics | None:
        session = server._sessions.get(session_id)
        if not isinstance(session, PersistentSession):
            raise HTTPException(status_code=404, detail="Session not found")
        return load_hitl_last_turn_metrics(session_id)

    @app.get("/sessions/{session_id}/config", response_model=SessionCreateRequest)
    async def get_session_config(session_id: str) -> SessionCreateRequest:
        session = server._sessions.get(session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found")
        return _resolve_session_config(session_id)

    @app.put("/sessions/{session_id}/config", response_model=SessionCreateRequest)
    async def put_session_config(session_id: str, request: SessionCreateRequest) -> SessionCreateRequest:
        session = server._sessions.get(session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found")
        return save_hitl_session_config(session_id, request)

    @app.patch("/sessions/{session_id}/config", response_model=SessionCreateRequest)
    async def patch_session_config(session_id: str, request: SessionUpdateRequest) -> SessionCreateRequest:
        session = server._sessions.get(session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Session not found")
        return update_hitl_session_config(session_id, request)

    @app.delete("/sessions/{session_id}/config", status_code=204)
    async def remove_session_config(session_id: str) -> None:
        delete_hitl_session_config(session_id)

    return app


def main() -> None:
    app = create_hitl_app()
    host = os.getenv("HITL_HOST", "0.0.0.0")
    port = int(os.getenv("HITL_PORT", "8001"))
    log_level = os.getenv("HITL_LOG_LEVEL", "info")
    uvicorn.run(app, host=host, port=port, log_level=log_level)
