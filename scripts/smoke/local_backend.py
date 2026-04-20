from __future__ import annotations

import asyncio
import os
import uuid
from pathlib import Path

from core.schemas.multi_agent import MultiAgentConfig, SpecialistAgentConfig
from core.schemas.session import SessionCreateRequest
from core.schemas.thinking import ThinkingConfig
from core.chat import ChatService
from core.services.tracing import TracingService
from scripts.smoke.common import SMOKE_RUNTIME_DIR, SmokeCaseResult, case_result, now_iso


SMOKE_MODEL_NAME = os.getenv("SMOKE_MODEL_NAME", "gpt-5.4-mini")


async def _run_basic_session() -> SmokeCaseResult:
    started_at = now_iso()
    service = ChatService()
    tracing_service = TracingService()
    token = f"LOCAL_SMOKE_OK_{uuid.uuid4().hex[:8]}"

    session = service.create_session(
        SessionCreateRequest(
            model_name=SMOKE_MODEL_NAME,
            system_prompt="You are a regression-test assistant. When the user asks for a token, return it exactly and add no explanation.",
            thinking=ThinkingConfig(enabled=False, effort=None, verbosity=None),
        )
    )
    response = await service.send_message(
        session.session_id,
        f"Return this token exactly: {token}",
    )
    exported = tracing_service.export(session_id=session.session_id)

    content = response.assistant.content if response.assistant else ""
    passed = token in (content or "")
    status = "passed" if passed else "failed"
    summary = "Local basic session completed and session trace was exported" if passed else "Local basic session returned unexpected content"
    return case_result(
        name="Local basic session",
        started_at=started_at,
        status=status,
        summary=summary,
        details=[
            f"session_id={session.session_id}",
            f"assistant={content!r}",
            f"trace_log_dir={session.trace_log_dir}",
            f"trace_files={exported.files}",
        ],
        artifacts=[session.trace_log_dir or "", *[str(Path(exported.log_dir) / name) for name in exported.files]],
        error=None if passed else f"assistant did not return expected token: {token}",
    )


async def _run_multi_agent_session() -> SmokeCaseResult:
    started_at = now_iso()
    service = ChatService()
    tracing_service = TracingService()
    expected_code = uuid.uuid4().hex[:10].upper()
    target_file = SMOKE_RUNTIME_DIR / "multi_agent_input.txt"
    target_file.write_text(
        "\n".join(
            [
                "This is a multi-agent smoke-test file.",
                f"SMOKE_CODE={expected_code}",
            ]
        ),
        encoding="utf-8",
    )

    session = service.create_session(
        SessionCreateRequest(
            model_name=SMOKE_MODEL_NAME,
            system_prompt=(
                "You are the coordinator. You cannot read files directly and must delegate local file tasks to the most suitable specialist."
                "Do not guess file contents. Return only the extracted result."
            ),
            thinking=ThinkingConfig(enabled=False, effort=None, verbosity=None),
            enabled_tools=[],
            multi_agent=MultiAgentConfig(
                supervisor_name="coordinator",
                specialists=[
                    SpecialistAgentConfig(
                        name="researcher",
                        description="Responsible for reading local files and extracting key information.",
                        enabled_tools=["read_file"],
                    )
                ],
            ),
        )
    )

    response = await service.send_message(
        session.session_id,
        f"Read file {target_file.resolve()} and find SMOKE_CODE. Return only CODE=<value>.",
    )
    exported = tracing_service.export(session_id=session.session_id)
    content = response.assistant.content if response.assistant else ""
    agent_metrics = response.metrics.agent_metrics if response.metrics else []
    specialist_used = any(
        metric.role == "specialist" and metric.turn_usage
        for metric in agent_metrics
    )
    passed = f"CODE={expected_code}" in (content or "") and specialist_used
    status = "passed" if passed else "failed"

    return case_result(
        name="Local multi-agent session",
        started_at=started_at,
        status=status,
        summary="Multi-agent delegation succeeded and the specialist read the local file" if passed else "Multi-agent delegation was not triggered reliably or the answer was incorrect",
        details=[
            f"session_id={session.session_id}",
            f"assistant={content!r}",
            f"specialist_used={specialist_used}",
            f"agent_metrics_count={len(agent_metrics)}",
            f"trace_log_dir={session.trace_log_dir}",
            f"trace_files={exported.files}",
        ],
        artifacts=[str(target_file), session.trace_log_dir or "", *[str(Path(exported.log_dir) / name) for name in exported.files]],
        error=None if passed else f"expected CODE={expected_code}, actual={content!r}",
    )


async def run() -> list[SmokeCaseResult]:
    return [
        await _run_basic_session(),
        await _run_multi_agent_session(),
    ]


def main() -> None:
    results = asyncio.run(run())
    for item in results:
        print(f"[{item.status}] {item.name}: {item.summary}")


if __name__ == "__main__":
    main()
