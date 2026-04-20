from __future__ import annotations

import asyncio

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
from core.chat import ChatService
from core.services.tracing import TracingService
from core.workflows import WorkflowService
from core.workflows.registry import get_workflow_catalog
from core.agents.factory import get_tool_catalog_response


class LocalSessionBackend:
    """本地 in-process backend。"""

    def __init__(self, service: ChatService | None = None) -> None:
        self.service = service or ChatService()
        self.service.restore_sessions()
        self.tracing_service = TracingService()
        self.workflow_service = WorkflowService()
        self._background_tasks: set[asyncio.Task[None]] = set()

    async def list_sessions(self) -> list[SessionSummary]:
        return self.service.list_sessions()

    async def create_session(self, config: SessionCreateRequest) -> SessionDetail:
        return self.service.create_session(config)

    async def update_session(self, session_id: str, update: SessionUpdateRequest) -> SessionDetail:
        return self.service.update_session(session_id, update)

    async def get_session(self, session_id: str) -> SessionDetail:
        return self.service.get_session(session_id).detail()

    async def get_session_wait(self, session_id: str, *, timeout: float | None = None) -> SessionDetail:
        session = self.service.get_session(session_id)
        deadline = asyncio.get_running_loop().time() + timeout if timeout is not None else None
        while session.detail().status == "running":
            if deadline is not None and asyncio.get_running_loop().time() >= deadline:
                break
            await asyncio.sleep(0.1)
        return session.detail()

    async def get_messages(self, session_id: str) -> list[ChatMessage]:
        return self.service.get_session(session_id).history()

    async def delete_session(self, session_id: str) -> None:
        self.service.delete_session(session_id)

    async def delete_messages(
        self,
        session_id: str,
        indices: list[int],
    ) -> SessionMessageDeleteResponse:
        return self.service.delete_session_messages(session_id, indices)

    async def run_turn(
        self,
        session_id: str,
        content: str,
        event_queue: asyncio.Queue | None = None,
        uploads: list[UploadFile] | None = None,
    ) -> MessageResponse:
        return await self.run_turn_message(
            session_id,
            {"content": content},
            event_queue=event_queue,
            uploads=uploads,
        )

    async def run_turn_message(
        self,
        session_id: str,
        message_payload: dict[str, object],
        event_queue: asyncio.Queue | None = None,
        uploads: list[UploadFile] | None = None,
    ) -> MessageResponse:
        session = self.service.get_session(session_id)
        result = await session.ask_message(
            dict(message_payload),
            event_queue=event_queue,
            uploads=uploads,
        )
        return MessageResponse(
            session_id=session_id,
            assistant=result.assistant,
            metrics=result.metrics,
            status="idle",
        )

    async def dispatch_turn(
        self,
        session_id: str,
        content: str,
        *,
        uploads: list[UploadFile] | None = None,
    ) -> MessageResponse:
        return await self.dispatch_turn_message(
            session_id,
            {"content": content},
            uploads=uploads,
        )

    async def dispatch_turn_message(
        self,
        session_id: str,
        message_payload: dict[str, object],
        *,
        uploads: list[UploadFile] | None = None,
    ) -> MessageResponse:
        session = self.service.get_session(session_id)
        if session.detail().status == "running":
            raise RuntimeError("当前会话正在处理上一条消息")

        async def _background_run() -> None:
            try:
                await session.ask_message(dict(message_payload), uploads=uploads)
            finally:
                self._background_tasks.discard(task)

        task = asyncio.create_task(_background_run())
        self._background_tasks.add(task)
        return MessageResponse(
            session_id=session_id,
            status="running",
        )

    async def resolve_interrupt(
        self,
        session_id: str,
        request: InterruptResumeRequest,
        event_queue: asyncio.Queue | None = None,
    ) -> MessageResponse:
        del session_id, request, event_queue
        raise RuntimeError("本地 backend 不支持 interrupt/resume，请切换到 HITL backend")

    async def list_workflows(self) -> list[WorkflowDefinitionSummary]:
        return self.workflow_service.list_definitions()

    async def plan_workflow_run(self, request: WorkflowPlannerRequest) -> WorkflowPlannerResponse:
        return await self.workflow_service.plan_run(request)

    async def start_agent_workflow_run(self, request: WorkflowPlannerRequest) -> WorkflowRunDetail:
        return await self.workflow_service.start_agent_run(request)

    async def list_workflow_runs(self) -> list[WorkflowRunSummary]:
        return self.workflow_service.list_runs()

    async def start_workflow_run(self, request: WorkflowRunRequest) -> WorkflowRunDetail:
        return await self.workflow_service.start_run(request)

    async def get_workflow_run(self, run_id: str) -> WorkflowRunDetail:
        return self.workflow_service.get_run(run_id)

    async def cancel_workflow_run(
        self,
        run_id: str,
        request: WorkflowRunControlRequest | None = None,
    ) -> WorkflowRunDetail:
        return self.workflow_service.cancel_run(run_id, request=request)

    async def terminate_workflow_run(
        self,
        run_id: str,
        request: WorkflowRunControlRequest | None = None,
    ) -> WorkflowRunDetail:
        return self.workflow_service.terminate_run(run_id, request=request)

    async def get_tool_catalog(self) -> ToolCatalogResponse:
        return get_tool_catalog_response()

    async def get_workflow_catalog(self) -> WorkflowCatalogResponse:
        return get_workflow_catalog()

    async def get_tracing_status(self) -> TracingStatus:
        return self.tracing_service.status()

    async def export_trace(self) -> TraceExportResult:
        return self.tracing_service.export()

    async def get_session_tracing_status(self, session_id: str) -> TracingStatus:
        self.service.get_session(session_id)
        return self.tracing_service.status(session_id=session_id)

    async def export_session_trace(self, session_id: str) -> TraceExportResult:
        self.service.get_session(session_id)
        return self.tracing_service.export(session_id=session_id)

    async def get_workflow_tracing_status(self, run_id: str) -> TracingStatus:
        self.workflow_service.get_run(run_id)
        return self.tracing_service.status(workflow_run_id=run_id)

    async def export_workflow_trace(self, run_id: str) -> TraceExportResult:
        self.workflow_service.get_run(run_id)
        return self.tracing_service.export(workflow_run_id=run_id)
