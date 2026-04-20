from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from core.schemas.preview import PreviewRunRequest, PreviewRunResponse
from core.schemas.preview import PreviewTerminalInputRequest, PreviewTerminalResizeRequest
from core.servers.api_context import ApiServices


def create_preview_router(services: ApiServices) -> APIRouter:
    router = APIRouter()

    def _require_local_chat_service():
        if services.chat_service is None:
            raise HTTPException(status_code=409, detail="当前 backend 不支持代码预览，请切换到 local backend")
        return services.chat_service

    @router.post("/api/sessions/{session_id}/preview-runs", response_model=PreviewRunResponse)
    async def run_preview(session_id: str, request: PreviewRunRequest) -> PreviewRunResponse:
        try:
            session = _require_local_chat_service().get_session(session_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="会话不存在")

        return await services.preview_service.run_preview(
            session_id=session_id,
            request=request,
            timeout_seconds=session.config.timeout_seconds,
        )

    @router.get("/api/sessions/{session_id}/preview-runs/{run_id}", response_model=PreviewRunResponse)
    async def get_preview_run(session_id: str, run_id: str) -> PreviewRunResponse:
        try:
            _require_local_chat_service().get_session(session_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="会话不存在")
        try:
            return await services.preview_service.get_run(session_id, run_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="预览记录不存在")

    @router.post("/api/sessions/{session_id}/preview-runs/{run_id}/terminal-input", response_model=PreviewRunResponse)
    async def write_preview_terminal_input(
        session_id: str,
        run_id: str,
        request: PreviewTerminalInputRequest,
    ) -> PreviewRunResponse:
        try:
            _require_local_chat_service().get_session(session_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="会话不存在")
        try:
            return await services.preview_service.write_terminal_input(session_id, run_id, request)
        except KeyError:
            raise HTTPException(status_code=404, detail="预览记录不存在")
        except RuntimeError as exc:
            raise HTTPException(status_code=409, detail=str(exc))

    @router.post("/api/sessions/{session_id}/preview-runs/{run_id}/terminate", response_model=PreviewRunResponse)
    async def terminate_preview_run(session_id: str, run_id: str) -> PreviewRunResponse:
        try:
            _require_local_chat_service().get_session(session_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="会话不存在")
        try:
            return await services.preview_service.terminate_run(session_id, run_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="预览记录不存在")

    @router.post("/api/sessions/{session_id}/preview-runs/{run_id}/resize", response_model=PreviewRunResponse)
    async def resize_preview_terminal(
        session_id: str,
        run_id: str,
        request: PreviewTerminalResizeRequest,
    ) -> PreviewRunResponse:
        try:
            _require_local_chat_service().get_session(session_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="会话不存在")
        try:
            return await services.preview_service.resize_terminal(session_id, run_id, request)
        except KeyError:
            raise HTTPException(status_code=404, detail="预览记录不存在")
        except RuntimeError as exc:
            raise HTTPException(status_code=409, detail=str(exc))

    @router.get("/api/sessions/{session_id}/preview-runs/{run_id}/files/{file_path:path}")
    @router.get("/api/sessions/{session_id}/preview-runs/{run_id}/artifacts/{file_path:path}")
    async def get_preview_file(session_id: str, run_id: str, file_path: str) -> FileResponse:
        try:
            _require_local_chat_service().get_session(session_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="会话不存在")
        try:
            artifact_path = services.preview_service.resolve_artifact_path(session_id, run_id, file_path)
        except KeyError:
            raise HTTPException(status_code=404, detail="预览记录不存在")
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="预览文件不存在")
        except ValueError:
            raise HTTPException(status_code=400, detail="非法的预览文件路径")
        return FileResponse(artifact_path)

    return router
