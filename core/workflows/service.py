from __future__ import annotations
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from dataclasses import dataclass
from typing import Protocol

from core.config.paths import PROJECT_ROOT
from core.schemas.workflow import (
    WorkflowDefinitionSummary,
    WorkflowPlannerPlan,
    WorkflowPlannerRequest,
    WorkflowPlannerResponse,
    WorkflowRunControlRequest,
    WorkflowRunDetail,
    WorkflowRunRequest,
    WorkflowRunSummary,
)
from core.tracing import get_workflow_trace_dir, workflow_trace_scope
from .planner import WorkflowPlanner
from .registry import get_workflow, list_workflows
from .storage import iter_persisted_workflow_runs, persist_workflow_run


def workflow_now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


@dataclass
class WorkflowRunRecord:
    detail: WorkflowRunDetail
    thread: threading.Thread | None = None
    control_mode: str | None = None
    control_reason: str | None = None


class WorkflowPlannerLike(Protocol):
    async def plan(
        self,
        *,
        goal: str,
        workflows: list[WorkflowDefinitionSummary],
    ) -> WorkflowPlannerPlan: ...


class WorkflowService:
    """统一的 workflow 运行服务。

    UI 或 API 不需要知道 workflow 背后是不是 @agent_task 图，只需要面对：
    - 可用 workflow 列表
    - run 创建
    - run 轮询
    """

    def __init__(self, planner: WorkflowPlannerLike | None = None) -> None:
        self._runs: dict[str, WorkflowRunRecord] = {}
        self._planner = planner or WorkflowPlanner()
        self.restore_runs()

    def restore_runs(self) -> list[WorkflowRunDetail]:
        """从 runtime/workflow_runs 恢复历史 run。

        workflow 线程无法像会话那样跨进程恢复，所以重启时若发现仍是
        queued/running，会显式标记为 error，避免前端永久显示“运行中”。
        """

        restored: list[WorkflowRunDetail] = []
        for detail in iter_persisted_workflow_runs():
            if detail.run_id in self._runs:
                continue
            if detail.status in {"queued", "running"}:
                detail.status = "error"
                detail.error = detail.error or "Workflow run 因服务重启被中断，未能继续执行。"
                detail.updated_at = workflow_now_iso()
                persist_workflow_run(detail)
            record = WorkflowRunRecord(detail=detail)
            self._runs[detail.run_id] = record
            restored.append(detail)
        return sorted(restored, key=lambda item: item.updated_at, reverse=True)

    def list_definitions(self) -> list[WorkflowDefinitionSummary]:
        return list_workflows()

    def list_runs(self) -> list[WorkflowRunSummary]:
        return sorted(
            [
                WorkflowRunSummary(
                    run_id=record.detail.run_id,
                    workflow_name=record.detail.workflow_name,
                    status=record.detail.status,
                    created_at=record.detail.created_at,
                    updated_at=record.detail.updated_at,
                    launch_mode=record.detail.launch_mode,
                    user_goal=record.detail.user_goal,
                    planner_generated_at=record.detail.planner_generated_at,
                    planner_reason=record.detail.planner_reason,
                    planner_confidence=record.detail.planner_confidence,
                    planner_warnings=list(record.detail.planner_warnings),
                    planner_missing_information=list(record.detail.planner_missing_information),
                    planner_candidate_workflows=list(record.detail.planner_candidate_workflows),
                    runtime=record.detail.runtime,
                    attempt_count=record.detail.attempt_count,
                    project_root=record.detail.project_root,
                    trace_log_dir=record.detail.trace_log_dir,
                )
                for record in self._runs.values()
            ],
            key=lambda item: item.updated_at,
            reverse=True,
        )

    def get_run(self, run_id: str) -> WorkflowRunDetail:
        try:
            return self._runs[run_id].detail
        except KeyError as exc:
            raise KeyError(f"未知 workflow run: {run_id}") from exc

    async def start_run(self, request: WorkflowRunRequest) -> WorkflowRunDetail:
        return self._start_run(
            request,
            launch_mode="manual",
        )

    async def plan_run(self, request: WorkflowPlannerRequest) -> WorkflowPlannerResponse:
        workflows = self.list_definitions()
        plan = await self._planner.plan(
            goal=request.goal.strip(),
            workflows=workflows,
        )
        return WorkflowPlannerResponse(
            goal=request.goal.strip(),
            generated_at=workflow_now_iso(),
            plan=plan,
        )

    async def start_agent_run(self, request: WorkflowPlannerRequest) -> WorkflowRunDetail:
        plan_response = await self.plan_run(request)
        return self._start_run(
            WorkflowRunRequest(
                workflow_name=plan_response.plan.workflow_name,
                input_payload=plan_response.plan.input_payload,
            ),
            launch_mode="agent",
            user_goal=plan_response.goal,
            planner_plan=plan_response.plan,
            planner_generated_at=plan_response.generated_at,
        )

    def cancel_run(
        self,
        run_id: str,
        *,
        request: WorkflowRunControlRequest | None = None,
    ) -> WorkflowRunDetail:
        record = self._runs.get(run_id)
        if record is None:
            raise KeyError(f"未知 workflow run: {run_id}")
        if record.detail.status in {"completed", "cancelled", "terminated", "error"}:
            return record.detail

        record.control_mode = "cancel"
        record.control_reason = request.reason if request is not None else None
        record.detail.status = "cancelled"
        record.detail.error = record.control_reason or "Workflow run 已被取消。"
        record.detail.updated_at = workflow_now_iso()
        persist_workflow_run(record.detail)
        return record.detail

    def terminate_run(
        self,
        run_id: str,
        *,
        request: WorkflowRunControlRequest | None = None,
    ) -> WorkflowRunDetail:
        record = self._runs.get(run_id)
        if record is None:
            raise KeyError(f"未知 workflow run: {run_id}")
        if record.detail.status in {"completed", "cancelled", "terminated", "error"}:
            return record.detail

        record.control_mode = "terminate"
        record.control_reason = request.reason if request is not None else None
        record.detail.status = "terminated"
        record.detail.error = record.control_reason or "Workflow run 已被终止。"
        record.detail.updated_at = workflow_now_iso()
        persist_workflow_run(record.detail)
        return record.detail

    def _start_run(
        self,
        request: WorkflowRunRequest,
        *,
        launch_mode: str,
        user_goal: str | None = None,
        planner_plan: WorkflowPlannerPlan | None = None,
        planner_generated_at: str | None = None,
    ) -> WorkflowRunDetail:
        definition = get_workflow(request.workflow_name)
        input_model = definition.input_model.model_validate(request.input_payload)
        run_id = str(uuid.uuid4())
        detail = WorkflowRunDetail(
            run_id=run_id,
            workflow_name=request.workflow_name,
            status="queued",
            created_at=workflow_now_iso(),
            updated_at=workflow_now_iso(),
            launch_mode=launch_mode,  # type: ignore[arg-type]
            user_goal=user_goal,
            planner_generated_at=planner_generated_at,
            planner_reason=planner_plan.reason if planner_plan else None,
            planner_confidence=planner_plan.confidence if planner_plan else None,
            planner_warnings=list(planner_plan.warnings) if planner_plan else [],
            planner_missing_information=list(planner_plan.missing_information) if planner_plan else [],
            planner_candidate_workflows=list(planner_plan.candidate_workflows) if planner_plan else [],
            runtime=request.runtime,
            attempt_count=0,
            input_payload=input_model.model_dump(),
            output_payload=None,
            error=None,
            project_root=str(PROJECT_ROOT),
            trace_log_dir=str(get_workflow_trace_dir(run_id)),
        )
        record = WorkflowRunRecord(detail=detail)
        self._runs[run_id] = record
        persist_workflow_run(detail)
        record.thread = threading.Thread(
            target=self._execute_run_sync,
            args=(run_id, definition, input_model),
            name=f"workflow-{run_id[:8]}",
            daemon=True,
        )
        record.thread.start()
        detail.status = "running"
        detail.updated_at = workflow_now_iso()
        persist_workflow_run(detail)
        return detail

    def _execute_once_with_runtime(
        self,
        definition,
        input_model,
        *,
        timeout_seconds: float | None,
    ) -> dict:
        if timeout_seconds is None:
            return definition.runner(input_model)

        with ThreadPoolExecutor(max_workers=1, thread_name_prefix="workflow-runner") as executor:
            future = executor.submit(definition.runner, input_model)
            try:
                return future.result(timeout=timeout_seconds)
            except FutureTimeoutError as exc:
                future.cancel()
                raise TimeoutError(f"Workflow run timed out after {timeout_seconds:.2f}s") from exc

    def _execute_run_sync(self, run_id: str, definition, input_model) -> None:
        record = self._runs[run_id]
        if record.control_mode is not None:
            return
        runtime = record.detail.runtime
        max_attempts = int(runtime.max_retries) + 1

        for attempt in range(1, max_attempts + 1):
            if record.control_mode is not None or record.detail.status in {"cancelled", "terminated"}:
                record.detail.updated_at = workflow_now_iso()
                persist_workflow_run(record.detail)
                return
            record.detail.attempt_count = attempt
            record.detail.updated_at = workflow_now_iso()
            persist_workflow_run(record.detail)
            try:
                with workflow_trace_scope(run_id):
                    result = self._execute_once_with_runtime(
                        definition,
                        input_model,
                        timeout_seconds=runtime.timeout_seconds,
                    )
                if record.control_mode is not None or record.detail.status in {"cancelled", "terminated"}:
                    record.detail.updated_at = workflow_now_iso()
                    persist_workflow_run(record.detail)
                    return
                record.detail.output_payload = result
                record.detail.status = "completed"
                record.detail.error = None
                record.detail.updated_at = workflow_now_iso()
                persist_workflow_run(record.detail)
                return
            except Exception as exc:
                if record.control_mode is not None or record.detail.status in {"cancelled", "terminated"}:
                    record.detail.updated_at = workflow_now_iso()
                    persist_workflow_run(record.detail)
                    return
                if attempt >= max_attempts:
                    record.detail.status = "error"
                    record.detail.error = f"{type(exc).__name__}: {exc}"
                    record.detail.updated_at = workflow_now_iso()
                    persist_workflow_run(record.detail)
                    return

                if runtime.retry_delay_seconds > 0:
                    time.sleep(runtime.retry_delay_seconds)
