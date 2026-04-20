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
                "你是网页工具 smoke tester。遇到联网检索任务时必须先调用 web_search，"
                "不要凭记忆直接回答。最后只返回一句简短结论。"
            ),
            thinking=ThinkingConfig(enabled=False, effort=None, verbosity=None),
            enabled_tools=["web_search"],
        )
    )

    event_queue: asyncio.Queue[dict] = asyncio.Queue()
    turn_task = asyncio.create_task(
        service.get_session(session.session_id).ask(
            "请搜索 OpenAI，并用一句话概括你看到的首屏结果主题。",
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
        name="Firecrawl 网页检索",
        started_at=started_at,
        status="passed" if passed else "failed",
        summary="agent 成功通过 web_search 完成联网检索" if passed else "网页检索未稳定触发 web_search 或返回为空",
        details=[
            f"session_id={session.session_id}",
            f"observed_tool_calls={observed_tool_calls}",
            f"assistant={content!r}",
        ],
        error=None if passed else "web_search 未出现在 step 工具调用里",
    )


async def _run_mcp_probe() -> SmokeCaseResult:
    started_at = now_iso()
    remote_url = os.getenv("SMOKE_MCP_REMOTE_URL")
    local_command = os.getenv("SMOKE_MCP_LOCAL_COMMAND")

    if not remote_url and not local_command:
        return case_result(
            name="MCP 集成探测",
            started_at=started_at,
            status="skipped",
            summary="当前环境未提供可用的 MCP 测试目标，自动跳过",
            details=[
                "可通过 SMOKE_MCP_REMOTE_URL 或 SMOKE_MCP_LOCAL_COMMAND 注入测试目标。",
            ],
        )

    return case_result(
        name="MCP 集成探测",
        started_at=started_at,
        status="skipped",
        summary="已探测到 MCP 测试配置入口，但当前脚本尚未实现自动握手链路",
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
