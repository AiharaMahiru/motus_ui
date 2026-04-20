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
            system_prompt="你是回归测试助手。用户要求返回 token 时，必须原样返回，不要添加额外解释。",
            thinking=ThinkingConfig(enabled=False, effort=None, verbosity=None),
        )
    )
    response = await service.send_message(
        session.session_id,
        f"请原样返回这个 token：{token}",
    )
    exported = tracing_service.export(session_id=session.session_id)

    content = response.assistant.content if response.assistant else ""
    passed = token in (content or "")
    status = "passed" if passed else "failed"
    summary = "本地普通会话完成并导出 session trace" if passed else "本地普通会话返回内容不符合预期"
    return case_result(
        name="本地普通会话",
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
        error=None if passed else f"assistant 未返回期望 token: {token}",
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
                "这是一个多代理 smoke 测试文件。",
                f"SMOKE_CODE={expected_code}",
            ]
        ),
        encoding="utf-8",
    )

    session = service.create_session(
        SessionCreateRequest(
            model_name=SMOKE_MODEL_NAME,
            system_prompt=(
                "你是协调者。你自己没有直接文件读取能力，遇到本地文件任务时必须委派给最合适的子代理。"
                "不要猜测文件内容。最终答案只返回解析结果。"
            ),
            thinking=ThinkingConfig(enabled=False, effort=None, verbosity=None),
            enabled_tools=[],
            multi_agent=MultiAgentConfig(
                supervisor_name="coordinator",
                specialists=[
                    SpecialistAgentConfig(
                        name="researcher",
                        description="负责读取本地文件并提取其中的关键信息。",
                        enabled_tools=["read_file"],
                    )
                ],
            ),
        )
    )

    response = await service.send_message(
        session.session_id,
        f"请读取文件 {target_file.resolve()} ，找出其中的 SMOKE_CODE，最终只返回格式 CODE=<值>。",
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
        name="本地多代理会话",
        started_at=started_at,
        status=status,
        summary="多代理委派成功，专家参与了本地文件读取" if passed else "多代理未稳定触发专家委派或答案不正确",
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
