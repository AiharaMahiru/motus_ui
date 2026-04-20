from __future__ import annotations

import asyncio
from pathlib import Path

import httpx

from scripts.smoke.common import (
    SmokeCaseResult,
    case_result,
    choose_free_port,
    default_smoke_env,
    now_iso,
    start_python_process,
    wait_for_http,
)


async def run() -> list[SmokeCaseResult]:
    started_at = now_iso()
    port = choose_free_port()
    base_url = f"http://127.0.0.1:{port}"
    code = (
        "from motus.serve import AgentServer;"
        "server=AgentServer('core.agents.hitl_demo_agent:demo_agent', max_workers=1);"
        f"server.run(host='127.0.0.1', port={port}, log_level='warning')"
    )
    process = start_python_process(
        "smoke_hitl_demo_server",
        code=code,
        env=default_smoke_env(),
    )

    try:
        await wait_for_http(f"{base_url}/sessions")
        async with httpx.AsyncClient(base_url=base_url, timeout=30.0) as client:
            created = await client.post("/sessions", json={})
            created.raise_for_status()
            session_id = created.json()["session_id"]

            sent = await client.post(f"/sessions/{session_id}/messages", json={"content": "Start"})
            sent.raise_for_status()

            interrupt_payload = None
            for _ in range(200):
                detail = await client.get(f"/sessions/{session_id}")
                detail.raise_for_status()
                detail_data = detail.json()
                if detail_data["status"] == "interrupted":
                    interrupts = detail_data.get("interrupts") or []
                    if interrupts:
                        interrupt_payload = interrupts[0]
                        break
                await asyncio.sleep(0.05)

            if interrupt_payload is None:
                return [
                    case_result(
                        name="HITL demo state machine",
                        started_at=started_at,
                        status="failed",
                        summary="demo server did not enter interrupted state",
                        details=[f"base_url={base_url}", f"session_id={session_id}"],
                        artifacts=[str(process.stdout_path), str(process.stderr_path)],
                        error="interrupt_payload was not received",
                    )
                ]

            resumed = await client.post(
                f"/sessions/{session_id}/resume",
                json={
                    "interrupt_id": interrupt_payload["interrupt_id"],
                    "value": {"answers": {"Continue the current operation?": "Continue"}},
                },
            )
            resumed.raise_for_status()

            final_detail = None
            for _ in range(200):
                detail = await client.get(f"/sessions/{session_id}")
                detail.raise_for_status()
                detail_data = detail.json()
                if detail_data["status"] == "idle" and detail_data.get("response"):
                    final_detail = detail_data
                    break
                await asyncio.sleep(0.05)

            assistant_content = ""
            if final_detail:
                assistant_content = (final_detail.get("response") or {}).get("content", "")

            passed = final_detail is not None and "Received user reply" in assistant_content
            return [
                case_result(
                    name="HITL demo state machine",
                    started_at=started_at,
                    status="passed" if passed else "failed",
                    summary="HITL demo completed interrupt -> resume -> idle flow" if passed else "HITL demo state machine did not meet expectations",
                    details=[
                        f"base_url={base_url}",
                        f"session_id={session_id}",
                        f"interrupt_type={interrupt_payload.get('type')}",
                        f"assistant_content={assistant_content!r}",
                    ],
                    artifacts=[str(process.stdout_path), str(process.stderr_path)],
                    error=None if passed else "Did not return to idle after resume or final reply was missing",
                )
            ]
    finally:
        process.terminate()


def main() -> None:
    results = asyncio.run(run())
    for item in results:
        print(f"[{item.status}] {item.name}: {item.summary}")


if __name__ == "__main__":
    main()
