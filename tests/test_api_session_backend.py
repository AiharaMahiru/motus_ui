import asyncio
import unittest

from fastapi.testclient import TestClient
from motus.models import ChatMessage

from core.schemas.session import (
    InterruptInfo,
    InterruptResumeRequest,
    MessageResponse,
    SessionCreateRequest,
    SessionDetail,
    SessionMessageDeleteResponse,
    SessionSummary,
    SessionUpdateRequest,
    TurnMetrics,
)
from core.schemas.tool_host import ToolCatalogResponse
from core.schemas.thinking import ThinkingConfig
from core.schemas.tracing import TraceExportResult, TracingConfigSummary, TracingStatus
from core.schemas.workflow_host import WorkflowCatalogResponse, WorkflowHostDescriptor
from core.schemas.workflow import (
    WorkflowDefinitionSummary,
    WorkflowPlannerRequest,
    WorkflowPlannerResponse,
    WorkflowRunControlRequest,
    WorkflowRunDetail,
    WorkflowRunRequest,
    WorkflowRunSummary,
)
from core.servers.api import create_app


def build_detail(
    session_id: str,
    *,
    title: str | None = "HITL API 测试",
    status: str = "idle",
    interrupts: list[InterruptInfo] | None = None,
) -> SessionDetail:
    config = SessionCreateRequest(title=title)
    return SessionDetail(
        session_id=session_id,
        title=title,
        status=status,  # type: ignore[arg-type]
        provider=config.provider,
        model_name=config.model_name,
        created_at="2026-04-19T00:00:00+00:00",
        updated_at="2026-04-19T00:00:00+00:00",
        message_count=1,
        total_usage={},
        total_cost_usd=None,
        last_error=None,
        system_prompt=config.system_prompt,
        pricing_model=config.pricing_model,
        cache_policy=config.cache_policy,
        max_steps=config.max_steps,
        timeout_seconds=config.timeout_seconds,
        thinking=config.thinking or ThinkingConfig(),
        enabled_tools=list(config.enabled_tools),
        mcp_servers=list(config.mcp_servers),
        multi_agent=config.multi_agent,
        sandbox=config.sandbox,
        human_in_the_loop=config.human_in_the_loop,
        approval_tool_names=list(config.approval_tool_names),
        input_guardrails=list(config.input_guardrails),
        output_guardrails=list(config.output_guardrails),
        tool_guardrails=list(config.tool_guardrails),
        response_format=config.response_format,
        memory=config.memory,
        context_window={"percent": "1%"},
        last_response=None,
        interrupts=interrupts,
        multi_agent_enabled=config.multi_agent.enabled(),
        specialist_count=config.multi_agent.specialist_count(),
    )


def build_tracing_status(scope: str = "runtime") -> TracingStatus:
    return TracingStatus(
        scope=scope,  # type: ignore[arg-type]
        session_id=None,
        workflow_run_id=None,
        project_root="/opt/Agent",
        runtime_initialized=True,
        trace_id="trace-1",
        collecting=False,
        tracked_task_count=0,
        runtime_tracked_task_count=0,
        log_dir="/opt/Agent/runtime/traces",
        viewer_url=None,
        available_files=[],
        config=TracingConfigSummary(
            collection_level="basic",
            export_enabled=True,
            online_tracing=False,
            cloud_enabled=False,
            log_dir="/opt/Agent/runtime/traces",
            project=None,
            build=None,
            session_id=None,
        ),
    )


class FakeSessionBackend:
    def __init__(self) -> None:
        self.detail = build_detail("session-1")
        self.resolve_requests: list[InterruptResumeRequest] = []
        self.deleted_messages: list[list[int]] = []
        self.wait_requests: list[tuple[str, float | None]] = []
        self.dispatch_requests: list[dict[str, object]] = []
        self.run_message_payloads: list[dict[str, object]] = []
        self.workflow_called = False
        self.tracing_called = False

    async def list_sessions(self) -> list[SessionSummary]:
        return [SessionSummary.model_validate(self.detail.model_dump())]

    async def create_session(self, config: SessionCreateRequest) -> SessionDetail:
        self.detail = build_detail(self.detail.session_id, title=config.title or "新会话")
        return self.detail

    async def update_session(self, session_id: str, update: SessionUpdateRequest) -> SessionDetail:
        assert session_id == self.detail.session_id
        next_title = update.title if update.title is not None else self.detail.title
        self.detail = build_detail(session_id, title=next_title, status=self.detail.status, interrupts=self.detail.interrupts)
        return self.detail

    async def get_session(self, session_id: str) -> SessionDetail:
        if session_id != self.detail.session_id:
            raise KeyError(session_id)
        return self.detail

    async def get_session_wait(self, session_id: str, *, timeout: float | None = None) -> SessionDetail:
        if session_id != self.detail.session_id:
            raise KeyError(session_id)
        self.wait_requests.append((session_id, timeout))
        return self.detail

    async def get_messages(self, session_id: str) -> list[ChatMessage]:
        if session_id != self.detail.session_id:
            raise KeyError(session_id)
        return [ChatMessage.user_message("请继续")]

    async def delete_session(self, session_id: str) -> None:
        if session_id != self.detail.session_id:
            raise KeyError(session_id)

    async def delete_messages(self, session_id: str, indices: list[int]) -> SessionMessageDeleteResponse:
        if session_id != self.detail.session_id:
            raise KeyError(session_id)
        self.deleted_messages.append(indices)
        return SessionMessageDeleteResponse(
            session_id=session_id,
            deleted_count=len(indices),
            message_count=max(0, self.detail.message_count - len(indices)),
            updated_at="2026-04-19T00:00:01+00:00",
        )

    async def run_turn(
        self,
        session_id: str,
        content: str,
        event_queue: asyncio.Queue | None = None,
        uploads=None,
    ) -> MessageResponse:
        if session_id != self.detail.session_id:
            raise KeyError(session_id)
        if uploads:
            raise RuntimeError("fake backend 不支持附件")
        if event_queue is not None:
            await event_queue.put(
                {
                    "event": "assistant.step",
                    "data": {
                        "session_id": session_id,
                        "agent_name": "supervisor",
                        "content": f"正在处理：{content}",
                        "tool_calls": [],
                        "timestamp": "2026-04-19T00:00:02+00:00",
                    },
                }
            )
            interrupt = InterruptInfo(
                interrupt_id="resume-1",
                type="approval",
                payload={"question": "是否允许继续执行？"},
            )
            await event_queue.put(
                {
                    "event": "session.interrupted",
                    "data": {
                        "session_id": session_id,
                        "interrupt": interrupt.model_dump(),
                        "metrics": TurnMetrics(
                            turn_usage={"prompt_tokens": 11},
                            session_usage={"total_tokens": 11},
                            turn_cost_usd=0.001,
                            session_cost_usd=0.001,
                            context_window={"percent": "1%"},
                            agent_metrics=[],
                        ).model_dump(),
                        "timestamp": "2026-04-19T00:00:03+00:00",
                    },
                }
            )
            self.detail = build_detail(session_id, status="interrupted", interrupts=[interrupt])
        return MessageResponse(
            session_id=session_id,
            status="interrupted",
            interrupts=self.detail.interrupts,
        )

    async def run_turn_message(
        self,
        session_id: str,
        message_payload: dict[str, object],
        event_queue: asyncio.Queue | None = None,
        uploads=None,
    ) -> MessageResponse:
        self.run_message_payloads.append(dict(message_payload))
        content = message_payload.get("content")
        return await self.run_turn(
            session_id,
            content if isinstance(content, str) else "",
            event_queue=event_queue,
            uploads=uploads,
        )

    async def dispatch_turn(
        self,
        session_id: str,
        content: str,
        *,
        uploads=None,
    ) -> MessageResponse:
        if session_id != self.detail.session_id:
            raise KeyError(session_id)
        self.dispatch_requests.append(
            {
                "session_id": session_id,
                "content": content,
                "upload_count": len(uploads or []),
            }
        )
        self.detail = build_detail(session_id, status="running", interrupts=[])
        return MessageResponse(session_id=session_id, status="running")

    async def resolve_interrupt(
        self,
        session_id: str,
        request: InterruptResumeRequest,
        event_queue: asyncio.Queue | None = None,
    ) -> MessageResponse:
        if session_id != self.detail.session_id:
            raise KeyError(session_id)
        self.resolve_requests.append(request)
        self.detail = build_detail(session_id, status="idle", interrupts=[])
        if event_queue is not None:
            await event_queue.put(
                {
                    "event": "assistant.final",
                    "data": {
                        "session_id": session_id,
                        "assistant": ChatMessage.assistant_message("已恢复并完成").model_dump(exclude_none=True),
                        "metrics": TurnMetrics(
                            turn_usage={"completion_tokens": 7},
                            session_usage={"total_tokens": 18},
                            turn_cost_usd=0.0015,
                            session_cost_usd=0.0025,
                            context_window={"percent": "2%"},
                            agent_metrics=[],
                        ).model_dump(),
                        "timestamp": "2026-04-19T00:00:04+00:00",
                    },
                }
            )
        return MessageResponse(
            session_id=session_id,
            status="idle",
            assistant=ChatMessage.assistant_message("已恢复并完成"),
        )

    async def list_workflows(self) -> list[WorkflowDefinitionSummary]:
        self.workflow_called = True
        return []

    async def plan_workflow_run(self, request: WorkflowPlannerRequest) -> WorkflowPlannerResponse:
        raise RuntimeError("unused")

    async def start_agent_workflow_run(self, request: WorkflowPlannerRequest) -> WorkflowRunDetail:
        raise RuntimeError("unused")

    async def list_workflow_runs(self) -> list[WorkflowRunSummary]:
        return []

    async def start_workflow_run(self, request: WorkflowRunRequest) -> WorkflowRunDetail:
        raise RuntimeError("unused")

    async def get_workflow_run(self, run_id: str) -> WorkflowRunDetail:
        raise RuntimeError("unused")

    async def cancel_workflow_run(
        self,
        run_id: str,
        request: WorkflowRunControlRequest | None = None,
    ) -> WorkflowRunDetail:
        del request
        return WorkflowRunDetail(
            run_id=run_id,
            workflow_name="demo",
            status="cancelled",
            created_at="2026-04-19T00:00:00+00:00",
            updated_at="2026-04-19T00:00:01+00:00",
            input_payload={},
            error="Workflow run 已被取消。",
        )

    async def terminate_workflow_run(
        self,
        run_id: str,
        request: WorkflowRunControlRequest | None = None,
    ) -> WorkflowRunDetail:
        del request
        return WorkflowRunDetail(
            run_id=run_id,
            workflow_name="demo",
            status="terminated",
            created_at="2026-04-19T00:00:00+00:00",
            updated_at="2026-04-19T00:00:01+00:00",
            input_payload={},
            error="Workflow run 已被终止。",
        )

    async def get_tool_catalog(self) -> ToolCatalogResponse:
        return ToolCatalogResponse(tools=[])

    async def get_workflow_catalog(self) -> WorkflowCatalogResponse:
        return WorkflowCatalogResponse(
            workflows=[
                WorkflowHostDescriptor(
                    name="text_insights",
                    source="builtin",
                    persistence="memory",
                )
            ]
        )

    async def get_tracing_status(self) -> TracingStatus:
        self.tracing_called = True
        return build_tracing_status("runtime")

    async def export_trace(self) -> TraceExportResult:
        raise RuntimeError("unused")

    async def get_session_tracing_status(self, session_id: str) -> TracingStatus:
        return build_tracing_status("session")

    async def export_session_trace(self, session_id: str) -> TraceExportResult:
        raise RuntimeError("unused")

    async def get_workflow_tracing_status(self, run_id: str) -> TracingStatus:
        return build_tracing_status("workflow")

    async def export_workflow_trace(self, run_id: str) -> TraceExportResult:
        raise RuntimeError("unused")


class ApiSessionBackendTests(unittest.TestCase):
    def setUp(self) -> None:
        self.backend = FakeSessionBackend()
        self.client = TestClient(create_app(session_backend=self.backend))

    def tearDown(self) -> None:
        self.client.close()

    def test_session_list_and_detail_route_use_backend(self) -> None:
        sessions = self.client.get("/api/sessions")
        self.assertEqual(sessions.status_code, 200)
        self.assertEqual(sessions.json()[0]["session_id"], "session-1")

        detail = self.client.get("/api/sessions/session-1")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()["title"], "HITL API 测试")

    def test_resume_route_calls_backend_interrupt_resolution(self) -> None:
        self.backend.detail = build_detail(
            "session-1",
            status="interrupted",
            interrupts=[InterruptInfo(interrupt_id="resume-1", type="approval", payload={"question": "继续？"})],
        )

        response = self.client.post(
            "/api/sessions/session-1/resume",
            json={"interrupt_id": "resume-1", "value": {"approved": True}},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "idle")
        self.assertEqual(len(self.backend.resolve_requests), 1)
        self.assertEqual(self.backend.resolve_requests[0].interrupt_id, "resume-1")
        self.assertEqual(self.backend.resolve_requests[0].value["approved"], True)

    def test_stream_route_surfaces_session_interrupted_event(self) -> None:
        response = self.client.post(
            "/api/sessions/session-1/messages/stream",
            json={"content": "请继续执行"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("event: assistant.step", response.text)
        self.assertIn("event: session.interrupted", response.text)
        self.assertIn('"interrupt_id": "resume-1"', response.text)
        self.assertIn("event: done", response.text)

    def test_get_session_route_supports_wait_query(self) -> None:
        response = self.client.get("/api/sessions/session-1", params={"wait": "true", "timeout": "5"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.backend.wait_requests, [("session-1", 5.0)])

    def test_message_route_accepts_extended_payload_when_backend_supports_it(self) -> None:
        response = self.client.post(
            "/api/sessions/session-1/messages",
            json={"content": "请继续", "user_params": {"source": "webui"}},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.backend.run_message_payloads[0]["user_params"], {"source": "webui"})

    def test_message_route_supports_async_dispatch_mode(self) -> None:
        response = self.client.post(
            "/api/sessions/session-1/messages",
            params={"wait": "false"},
            json={"content": "后台继续"},
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["status"], "running")
        self.assertEqual(self.backend.dispatch_requests[0]["content"], "后台继续")

    def test_workflow_and_runtime_tracing_routes_delegate_to_backend(self) -> None:
        workflows = self.client.get("/api/workflows")
        tracing = self.client.get("/api/tracing")

        self.assertEqual(workflows.status_code, 200)
        self.assertEqual(tracing.status_code, 200)
        self.assertTrue(self.backend.workflow_called)
        self.assertTrue(self.backend.tracing_called)

    def test_workflow_control_routes_delegate_to_backend(self) -> None:
        cancelled = self.client.post(
            "/api/workflows/runs/run-1/cancel",
            json={"reason": "用户取消"},
        )
        terminated = self.client.post(
            "/api/workflows/runs/run-1/terminate",
            json={"reason": "强制终止"},
        )

        self.assertEqual(cancelled.status_code, 200)
        self.assertEqual(cancelled.json()["status"], "cancelled")
        self.assertEqual(terminated.status_code, 200)
        self.assertEqual(terminated.json()["status"], "terminated")

    def test_runtime_catalog_routes_delegate_to_backend(self) -> None:
        tools = self.client.get("/api/runtime/tools")
        workflows = self.client.get("/api/runtime/workflow-catalog")

        self.assertEqual(tools.status_code, 200)
        self.assertEqual(workflows.status_code, 200)
        self.assertIn("text_insights", {item["name"] for item in workflows.json()["workflows"]})


if __name__ == "__main__":
    unittest.main()
