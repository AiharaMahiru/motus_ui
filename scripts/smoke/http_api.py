from __future__ import annotations

import asyncio
import os
from pathlib import Path

import httpx

from scripts.smoke.common import (
    SmokeCaseResult,
    case_result,
    choose_free_port,
    collect_sse_events,
    default_smoke_env,
    now_iso,
    start_python_process,
    wait_for_http,
)


SMOKE_MODEL_NAME = os.getenv("SMOKE_MODEL_NAME", "gpt-5.4-mini")


async def run() -> list[SmokeCaseResult]:
    started_at = now_iso()
    port = choose_free_port()
    base_url = f"http://127.0.0.1:{port}"
    env = default_smoke_env()
    env["APP_HOST"] = "127.0.0.1"
    env["APP_PORT"] = str(port)

    process = start_python_process(
        "smoke_http_api_server",
        module="apps.server",
        env=env,
    )

    results: list[SmokeCaseResult] = []
    try:
        await wait_for_http(f"{base_url}/health")
        async with httpx.AsyncClient(base_url=base_url, timeout=60.0) as client:
            health = await client.get("/health")
            health.raise_for_status()

            results.append(
                case_result(
                    name="HTTP API 健康检查",
                    started_at=started_at,
                    summary="HTTP 服务启动成功，health 接口可访问",
                    details=[f"base_url={base_url}", f"health={health.json()}"],
                    artifacts=[str(process.stdout_path), str(process.stderr_path)],
                )
            )

            session_started_at = now_iso()
            create_resp = await client.post(
                "/api/sessions",
                json={
                    "model_name": SMOKE_MODEL_NAME,
                    "system_prompt": "你是回归测试助手。用户要求返回 token 时，必须原样返回。",
                    "thinking": {"enabled": False, "effort": None, "verbosity": None},
                },
            )
            create_resp.raise_for_status()
            session_detail = create_resp.json()
            session_id = session_detail["session_id"]
            token = f"HTTP_STREAM_OK_{session_id[:8]}"
            events = await collect_sse_events(
                client,
                f"/api/sessions/{session_id}/messages/stream",
                json_payload={"content": f"请原样返回这个 token：{token}"},
            )
            event_names = [event["event"] for event in events]
            final_events = [event for event in events if event["event"] == "assistant.final"]
            assistant_content = ""
            if final_events:
                assistant_content = (
                    final_events[-1]["data"]
                    .get("assistant", {})
                    .get("content", "")
                )

            tracing_status = await client.get(f"/api/sessions/{session_id}/tracing")
            tracing_status.raise_for_status()
            tracing_export = await client.post(f"/api/sessions/{session_id}/tracing/export")
            tracing_export.raise_for_status()
            tracing_export_data = tracing_export.json()

            passed_session = (
                "assistant.final" in event_names
                and "done" in event_names
                and token in assistant_content
            )
            results.append(
                case_result(
                    name="HTTP API 会话与流式事件",
                    started_at=session_started_at,
                    status="passed" if passed_session else "failed",
                    summary="会话创建、SSE 流和 session tracing 接口正常" if passed_session else "会话流式链路未达到预期",
                    details=[
                        f"session_id={session_id}",
                        f"event_names={event_names}",
                        f"assistant_content={assistant_content!r}",
                        f"trace_log_dir={session_detail.get('trace_log_dir')}",
                        f"trace_files={tracing_export_data.get('files')}",
                    ],
                    artifacts=[
                        session_detail.get("trace_log_dir") or "",
                        *[
                            str(Path(tracing_export_data["log_dir"]) / name)
                            for name in tracing_export_data.get("files", [])
                        ],
                    ],
                    error=None if passed_session else f"SSE 事件或 assistant 内容不符合预期: {event_names}",
                )
            )

            workflow_started_at = now_iso()
            workflow_resp = await client.post(
                "/api/workflows/runs",
                json={
                    "workflow_name": "text_insights",
                    "input_payload": {"text": "# 标题\n\n这是第一段。\n\n这是第二段。"},
                },
            )
            workflow_resp.raise_for_status()
            workflow_detail = workflow_resp.json()
            run_id = workflow_detail["run_id"]

            while True:
                current = await client.get(f"/api/workflows/runs/{run_id}")
                current.raise_for_status()
                current_data = current.json()
                if current_data["status"] in {"completed", "error"}:
                    break
                await asyncio.sleep(0.05)

            workflow_trace = await client.get(f"/api/workflows/runs/{run_id}/tracing")
            workflow_trace.raise_for_status()
            workflow_export = await client.post(f"/api/workflows/runs/{run_id}/tracing/export")
            workflow_export.raise_for_status()
            workflow_export_data = workflow_export.json()

            passed_workflow = current_data["status"] == "completed" and bool(workflow_export_data.get("files"))
            results.append(
                case_result(
                    name="HTTP API Workflow 与 Tracing",
                    started_at=workflow_started_at,
                    status="passed" if passed_workflow else "failed",
                    summary="workflow API 与 workflow run tracing 接口正常" if passed_workflow else "workflow API 或 tracing 接口未达到预期",
                    details=[
                        f"run_id={run_id}",
                        f"workflow_status={current_data['status']}",
                        f"trace_log_dir={current_data.get('trace_log_dir')}",
                        f"trace_files={workflow_export_data.get('files')}",
                    ],
                    artifacts=[
                        current_data.get("trace_log_dir") or "",
                        *[
                            str(Path(workflow_export_data["log_dir"]) / name)
                            for name in workflow_export_data.get("files", [])
                        ],
                    ],
                    error=None if passed_workflow else current_data.get("error") or "workflow 未完成",
                )
            )
    finally:
        process.terminate()

    return results


def main() -> None:
    results = asyncio.run(run())
    for item in results:
        print(f"[{item.status}] {item.name}: {item.summary}")


if __name__ == "__main__":
    main()
