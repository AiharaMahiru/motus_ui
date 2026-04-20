from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter, HTTPException

from core.schemas.meta import AppMeta
from core.schemas.runtime import RuntimeRequirementsResponse
from core.schemas.tool_host import ToolCatalogResponse
from core.schemas.tracing import TraceExportResult, TracingStatus
from core.schemas.workflow_host import WorkflowCatalogResponse
from core.servers.api_context import ApiServices


def _raise_backend_error(exc: Exception) -> None:
    if isinstance(exc, KeyError):
        raise HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, RuntimeError):
        raise HTTPException(status_code=409, detail=str(exc))
    if isinstance(exc, httpx.HTTPStatusError):
        detail = ""
        try:
            payload = exc.response.json()
            if isinstance(payload, dict):
                detail = str(payload.get("detail") or "")
        except Exception:
            detail = ""
        raise HTTPException(status_code=exc.response.status_code, detail=detail or str(exc))
    if isinstance(exc, httpx.HTTPError):
        raise HTTPException(status_code=502, detail=f"HITL backend 不可用: {exc}")
    raise HTTPException(status_code=400, detail=str(exc))


def create_system_router(services: ApiServices) -> APIRouter:
    router = APIRouter()

    @router.get("/health")
    async def health() -> dict[str, Any]:
        try:
            sessions = await services.session_backend.list_sessions()
        except Exception as exc:
            return {"status": "degraded", "sessions": 0, "backend_error": str(exc)}
        return {"status": "ok", "sessions": len(sessions)}

    @router.get("/api/meta", response_model=AppMeta)
    async def get_meta() -> AppMeta:
        return services.system_service.get_app_meta()

    @router.get("/api/runtime/requirements", response_model=RuntimeRequirementsResponse)
    async def get_runtime_requirements() -> RuntimeRequirementsResponse:
        return services.system_service.get_runtime_requirements()

    @router.get("/api/runtime/tools", response_model=ToolCatalogResponse)
    async def get_tool_catalog() -> ToolCatalogResponse:
        try:
            return await services.session_backend.get_tool_catalog()
        except Exception as exc:
            _raise_backend_error(exc)

    @router.get("/api/runtime/workflow-catalog", response_model=WorkflowCatalogResponse)
    async def get_workflow_catalog() -> WorkflowCatalogResponse:
        try:
            return await services.session_backend.get_workflow_catalog()
        except Exception as exc:
            _raise_backend_error(exc)

    @router.get("/api/tracing", response_model=TracingStatus)
    async def get_tracing_status() -> TracingStatus:
        try:
            return await services.session_backend.get_tracing_status()
        except Exception as exc:
            _raise_backend_error(exc)

    @router.post("/api/tracing/export", response_model=TraceExportResult)
    async def export_trace() -> TraceExportResult:
        try:
            return await services.session_backend.export_trace()
        except Exception as exc:
            _raise_backend_error(exc)

    return router
