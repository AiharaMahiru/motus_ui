from __future__ import annotations

import asyncio

from core.schemas.workflow import WorkflowRunRequest
from core.services.tracing import TracingService
from core.workflows import WorkflowService
from scripts.smoke.common import SmokeCaseResult, case_result, now_iso


async def _run_workflow_text_insights() -> SmokeCaseResult:
    started_at = now_iso()
    workflow_service = WorkflowService()
    tracing_service = TracingService()

    detail = await workflow_service.start_run(
        WorkflowRunRequest(
            workflow_name="text_insights",
            input_payload={"text": "# 标题\n\n这是第一段。\n\n这是第二段。"},
        )
    )
    run_id = detail.run_id

    while True:
        current = workflow_service.get_run(run_id)
        if current.status in {"completed", "error"}:
            break
        await asyncio.sleep(0.05)

    tracing_status = tracing_service.status(workflow_run_id=run_id)
    exported = tracing_service.export(workflow_run_id=run_id)
    passed = current.status == "completed" and bool(current.output_payload) and bool(exported.files)

    return case_result(
        name="Workflow Text Insights",
        started_at=started_at,
        status="passed" if passed else "failed",
        summary="workflow 运行完成并成功导出 workflow run 级 trace" if passed else "workflow 或 tracing 导出未达到预期",
        details=[
            f"run_id={run_id}",
            f"workflow_status={current.status}",
            f"trace_scope={tracing_status.scope}",
            f"trace_log_dir={current.trace_log_dir}",
            f"trace_files={exported.files}",
            f"output_keys={sorted((current.output_payload or {}).keys())}",
        ],
        artifacts=[current.trace_log_dir or "", *[f"{exported.log_dir}/{name}" for name in exported.files]],
        error=None if passed else current.error or "workflow tracing 导出失败",
    )


async def run() -> list[SmokeCaseResult]:
    return [await _run_workflow_text_insights()]


def main() -> None:
    results = asyncio.run(run())
    for item in results:
        print(f"[{item.status}] {item.name}: {item.summary}")


if __name__ == "__main__":
    main()
