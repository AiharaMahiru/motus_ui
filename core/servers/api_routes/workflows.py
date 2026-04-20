from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException

from core.schemas.tracing import TraceExportResult, TracingStatus
from core.schemas.workflow import (
    WorkflowDefinitionSummary,
    WorkflowPlannerRequest,
    WorkflowPlannerResponse,
    WorkflowRunControlRequest,
    WorkflowRunDetail,
    WorkflowRunRequest,
    WorkflowRunSummary,
)
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


def create_workflow_router(services: ApiServices) -> APIRouter:
    router = APIRouter()

    @router.get("/api/workflows", response_model=list[WorkflowDefinitionSummary])
    async def list_workflows() -> list[WorkflowDefinitionSummary]:
        try:
            return await services.session_backend.list_workflows()
        except Exception as exc:
            _raise_backend_error(exc)

    @router.post("/api/workflows/plans", response_model=WorkflowPlannerResponse)
    async def plan_workflow(request: WorkflowPlannerRequest) -> WorkflowPlannerResponse:
        try:
            return await services.session_backend.plan_workflow_run(request)
        except Exception as exc:
            _raise_backend_error(exc)

    @router.get("/api/workflows/runs", response_model=list[WorkflowRunSummary])
    async def list_workflow_runs() -> list[WorkflowRunSummary]:
        try:
            return await services.session_backend.list_workflow_runs()
        except Exception as exc:
            _raise_backend_error(exc)

    @router.post("/api/workflows/agent-runs", response_model=WorkflowRunDetail, status_code=202)
    async def start_agent_workflow_run(request: WorkflowPlannerRequest) -> WorkflowRunDetail:
        try:
            return await services.session_backend.start_agent_workflow_run(request)
        except Exception as exc:
            _raise_backend_error(exc)

    @router.post("/api/workflows/runs", response_model=WorkflowRunDetail, status_code=202)
    async def start_workflow_run(request: WorkflowRunRequest) -> WorkflowRunDetail:
        try:
            return await services.session_backend.start_workflow_run(request)
        except Exception as exc:
            _raise_backend_error(exc)

    @router.get("/api/workflows/runs/{run_id}", response_model=WorkflowRunDetail)
    async def get_workflow_run(run_id: str) -> WorkflowRunDetail:
        try:
            return await services.session_backend.get_workflow_run(run_id)
        except Exception as exc:
            _raise_backend_error(exc)

    @router.post("/api/workflows/runs/{run_id}/cancel", response_model=WorkflowRunDetail)
    async def cancel_workflow_run(
        run_id: str,
        request: WorkflowRunControlRequest,
    ) -> WorkflowRunDetail:
        try:
            return await services.session_backend.cancel_workflow_run(run_id, request)
        except Exception as exc:
            _raise_backend_error(exc)

    @router.post("/api/workflows/runs/{run_id}/terminate", response_model=WorkflowRunDetail)
    async def terminate_workflow_run(
        run_id: str,
        request: WorkflowRunControlRequest,
    ) -> WorkflowRunDetail:
        try:
            return await services.session_backend.terminate_workflow_run(run_id, request)
        except Exception as exc:
            _raise_backend_error(exc)

    @router.get("/api/workflows/runs/{run_id}/tracing", response_model=TracingStatus)
    async def get_workflow_tracing_status(run_id: str) -> TracingStatus:
        try:
            return await services.session_backend.get_workflow_tracing_status(run_id)
        except Exception as exc:
            _raise_backend_error(exc)

    @router.post("/api/workflows/runs/{run_id}/tracing/export", response_model=TraceExportResult)
    async def export_workflow_trace(run_id: str) -> TraceExportResult:
        try:
            return await services.session_backend.export_workflow_trace(run_id)
        except Exception as exc:
            _raise_backend_error(exc)

    return router
