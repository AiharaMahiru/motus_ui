from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from fastapi import UploadFile
from motus.models import ChatMessage

from core.schemas.session import (
    InterruptResumeRequest,
    MessageResponse,
    SessionCreateRequest,
    SessionDetail,
    SessionMessageDeleteResponse,
    SessionSummary,
    SessionUpdateRequest,
)
from core.schemas.tool_host import ToolCatalogResponse
from core.schemas.tracing import TraceExportResult, TracingStatus
from core.schemas.workflow_host import WorkflowCatalogResponse
from core.schemas.workflow import (
    WorkflowDefinitionSummary,
    WorkflowRunControlRequest,
    WorkflowPlannerRequest,
    WorkflowPlannerResponse,
    WorkflowRunDetail,
    WorkflowRunRequest,
    WorkflowRunSummary,
)


@dataclass
class BackendEvent:
    session_id: str
    event_name: str
    payload: dict[str, Any]


class SessionBackend(Protocol):
    """统一的会话 backend 协议。

    UI 层只依赖这组方法，就不需要知道当前后端到底是：
    - 本地 in-process service
    - 远端 HTTP server
    - HITL server
    """

    async def list_sessions(self) -> list[SessionSummary]: ...

    async def create_session(self, config: SessionCreateRequest) -> SessionDetail: ...

    async def update_session(self, session_id: str, update: SessionUpdateRequest) -> SessionDetail: ...

    async def get_session(self, session_id: str) -> SessionDetail: ...

    async def get_session_wait(self, session_id: str, *, timeout: float | None = None) -> SessionDetail: ...

    async def get_messages(self, session_id: str) -> list[ChatMessage]: ...

    async def delete_session(self, session_id: str) -> None: ...

    async def delete_messages(
        self,
        session_id: str,
        indices: list[int],
    ) -> SessionMessageDeleteResponse: ...

    async def run_turn(
        self,
        session_id: str,
        content: str,
        event_queue: "asyncio.Queue[BackendEvent] | None" = None,
        uploads: list[UploadFile] | None = None,
    ) -> MessageResponse: ...

    async def run_turn_message(
        self,
        session_id: str,
        message_payload: dict[str, Any],
        event_queue: "asyncio.Queue[BackendEvent] | None" = None,
        uploads: list[UploadFile] | None = None,
    ) -> MessageResponse: ...

    async def dispatch_turn_message(
        self,
        session_id: str,
        message_payload: dict[str, Any],
        *,
        uploads: list[UploadFile] | None = None,
    ) -> MessageResponse: ...

    async def resolve_interrupt(
        self,
        session_id: str,
        request: InterruptResumeRequest,
        event_queue: "asyncio.Queue[BackendEvent] | None" = None,
    ) -> MessageResponse: ...

    async def list_workflows(self) -> list[WorkflowDefinitionSummary]: ...

    async def plan_workflow_run(self, request: WorkflowPlannerRequest) -> WorkflowPlannerResponse: ...

    async def start_agent_workflow_run(self, request: WorkflowPlannerRequest) -> WorkflowRunDetail: ...

    async def list_workflow_runs(self) -> list[WorkflowRunSummary]: ...

    async def start_workflow_run(self, request: WorkflowRunRequest) -> WorkflowRunDetail: ...

    async def get_workflow_run(self, run_id: str) -> WorkflowRunDetail: ...

    async def cancel_workflow_run(
        self,
        run_id: str,
        request: WorkflowRunControlRequest | None = None,
    ) -> WorkflowRunDetail: ...

    async def terminate_workflow_run(
        self,
        run_id: str,
        request: WorkflowRunControlRequest | None = None,
    ) -> WorkflowRunDetail: ...

    async def get_tool_catalog(self) -> ToolCatalogResponse: ...

    async def get_workflow_catalog(self) -> WorkflowCatalogResponse: ...

    async def get_tracing_status(self) -> TracingStatus: ...

    async def export_trace(self) -> TraceExportResult: ...

    async def get_session_tracing_status(self, session_id: str) -> TracingStatus: ...

    async def export_session_trace(self, session_id: str) -> TraceExportResult: ...

    async def get_workflow_tracing_status(self, run_id: str) -> TracingStatus: ...

    async def export_workflow_trace(self, run_id: str) -> TraceExportResult: ...
