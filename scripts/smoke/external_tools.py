from __future__ import annotations

import asyncio
import os

from core.schemas.session import SessionCreateRequest
from core.schemas.thinking import ThinkingConfig
from core.chat import ChatService
from scripts.smoke.common import SmokeCaseResult, case_result, now_iso


SMOKE_MODEL_NAME = os.getenv("SMOKE_MODEL_NAME", "gpt-5.4-mini")


async def _run_firecrawl_search() -> SmokeCaseResult:
    started_at = now_iso()
    service = ChatService()
    session = service.create_session(
        SessionCreateRequest(
            model_name=SMOKE_MODEL_NAME,
            system_prompt=(
                "You are a web-tool smoke tester. For web-search tasks, you must call web_search first. "
                "Do not answer from memory. Return one short conclusion only."
            ),
            thinking=ThinkingConfig(enabled=False, effort=None, verbosity=None),
            enabled_tools=["web_search"],
        )
    )

    event_queue: asyncio.Queue[dict] = asyncio.Queue()
    turn_task = asyncio.create_task(
        service.get_session(session.session_id).ask(
            "Search OpenAI and summarize the first-page result theme in one sentence.",
            event_queue=event_queue,
        )
    )
    observed_tool_calls: list[str] = []
    while True:
        if turn_task.done() and event_queue.empty():
            break
        try:
            event = await asyncio.wait_for(event_queue.get(), timeout=0.2)
        except asyncio.TimeoutError:
            continue
        if event["event"] == "assistant.step":
            for call in event["data"].get("tool_calls", []):
                observed_tool_calls.append(call.get("name", ""))

    result = await turn_task
    content = result.assistant.content or ""
    passed = "web_search" in observed_tool_calls and bool(content.strip())
    return case_result(
        name="Firecrawl web search",
        started_at=started_at,
        status="passed" if passed else "failed",
        summary="Agent completed web search through web_search" if passed else "Web search did not reliably trigger web_search or returned empty content",
        details=[
            f"session_id={session.session_id}",
            f"observed_tool_calls={observed_tool_calls}",
            f"assistant={content!r}",
        ],
        error=None if passed else "web_search did not appear in step tool calls",
    )


async def _run_mcp_probe() -> SmokeCaseResult:
    started_at = now_iso()
    remote_url = os.getenv("SMOKE_MCP_REMOTE_URL")
    local_command = os.getenv("SMOKE_MCP_LOCAL_COMMAND")

    if not remote_url and not local_command:
        return case_result(
            name="MCP integration probe",
            started_at=started_at,
            status="skipped",
            summary="No usable MCP test target was provided; skipping automatically",
            details=[
                "Set SMOKE_MCP_REMOTE_URL or SMOKE_MCP_LOCAL_COMMAND to inject a test target.",
            ],
        )

    return case_result(
        name="MCP integration probe",
        started_at=started_at,
        status="skipped",
        summary="MCP test configuration was detected, but automated handshake is not implemented yet",
        details=[
            f"SMOKE_MCP_REMOTE_URL={remote_url}",
            f"SMOKE_MCP_LOCAL_COMMAND={local_command}",
        ],
    )


async def run() -> list[SmokeCaseResult]:
    return [
        await _run_firecrawl_search(),
        await _run_mcp_probe(),
    ]


def main() -> None:
    results = asyncio.run(run())
    for item in results:
        print(f"[{item.status}] {item.name}: {item.summary}")


if __name__ == "__main__":
    main()
