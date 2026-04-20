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
                    name="HTTP API health check",
                    started_at=started_at,
                    summary="HTTP service started and health endpoint is reachable",
                    details=[f"base_url={base_url}", f"health={health.json()}"],
                    artifacts=[str(process.stdout_path), str(process.stderr_path)],
                )
            )

            session_started_at = now_iso()
            create_resp = await client.post(
                "/api/sessions",
                json={
                    "model_name": SMOKE_MODEL_NAME,
                    "system_prompt": "You are a regression-test assistant. When the user asks for a token, return it exactly.",
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
                json_payload={"content": f"Return this token exactly: {token}"},
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
                    name="HTTP API session and stream events",
                    started_at=session_started_at,
                    status="passed" if passed_session else "failed",
                    summary="Session creation, SSE stream, and session tracing endpoints are healthy" if passed_session else "Session streaming path did not meet expectations",
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
                    error=None if passed_session else f"SSE events or assistant content did not meet expectations: {event_names}",
                )
            )

            workflow_started_at = now_iso()
            workflow_resp = await client.post(
                "/api/workflows/runs",
                json={
                    "workflow_name": "text_insights",
                    "input_payload": {"text": "# Title\n\nThis is the first paragraph.\n\nThis is the second paragraph."},
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
                    name="HTTP API workflow and tracing",
                    started_at=workflow_started_at,
                    status="passed" if passed_workflow else "failed",
                    summary="Workflow API and workflow-run tracing endpoints are healthy" if passed_workflow else "Workflow API or tracing endpoint did not meet expectations",
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
                    error=None if passed_workflow else current_data.get("error") or "workflow did not complete",
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
