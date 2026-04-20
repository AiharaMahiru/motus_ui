from __future__ import annotations

import asyncio
import json
import os
import uuid
from pathlib import Path
from typing import Any

import httpx

from core.config.env import load_project_env
from scripts.smoke.hitl_real_support import resolve_real_hitl_model
from scripts.smoke.common import (
    PROJECT_ROOT,
    SMOKE_RUNTIME_DIR,
    SmokeCaseResult,
    case_result,
    choose_free_port,
    default_smoke_env,
    markdown_report,
    now_iso,
    start_python_process,
    wait_for_http,
)


load_project_env()

RESULTS_DOC_PATH = PROJECT_ROOT / "docs" / "真实-HITL-端到端联调结果.md"
RESULTS_JSON_PATH = SMOKE_RUNTIME_DIR / "real-hitl-e2e-results.json"
REAL_HITL_TIMEOUT_SECONDS = float(os.getenv("SMOKE_REAL_HITL_TIMEOUT_SECONDS", "240"))


def _bool_status(value: bool) -> str:
    return "passed" if value else "failed"


async def _wait_for_terminal_or_interrupt(
    client: httpx.AsyncClient,
    session_id: str,
    *,
    timeout_seconds: float,
) -> dict[str, Any]:
    """等待会话离开 running，拿到 interrupted / idle / error。"""

    deadline = asyncio.get_running_loop().time() + timeout_seconds
    while True:
        if asyncio.get_running_loop().time() > deadline:
            raise TimeoutError(f"等待会话状态变化超时: {session_id}")

        response = await client.get(
            f"/api/sessions/{session_id}",
            params={"wait": "true", "timeout": "20"},
        )
        response.raise_for_status()
        detail = response.json()
        if detail["status"] in {"interrupted", "idle", "error"}:
            return detail

        await asyncio.sleep(0.2)


def _extract_answers_payload(interrupt: dict[str, Any], *, answer_label: str) -> dict[str, Any]:
    payload = interrupt.get("payload") or {}
    questions = payload.get("questions")
    if isinstance(questions, list) and questions:
        answers = {}
        for question in questions:
            if not isinstance(question, dict):
                continue
            question_text = str(question.get("question") or "").strip()
            if question_text:
                answers[question_text] = answer_label
        if answers:
            return {"answers": answers}

    question_text = str(payload.get("question") or payload.get("message") or "继续执行？").strip()
    return {"answers": {question_text: answer_label}}


async def _resume_interrupt(
    client: httpx.AsyncClient,
    session_id: str,
    interrupt: dict[str, Any],
) -> httpx.Response:
    interrupt_type = str(interrupt.get("type") or "")
    if interrupt_type == "user_input":
        value = _extract_answers_payload(interrupt, answer_label="继续")
    else:
        value = {"approved": True}

    response = await client.post(
        f"/api/sessions/{session_id}/resume",
        json={
            "interrupt_id": interrupt["interrupt_id"],
            "value": value,
        },
    )
    response.raise_for_status()
    return response


async def _run_user_input_case(
    client: httpx.AsyncClient,
    *,
    base_url: str,
    model_name: str,
) -> SmokeCaseResult:
    started_at = now_iso()
    token = f"REAL_HITL_USER_INPUT_OK_{uuid.uuid4().hex[:8]}"
    create_response = await client.post(
        "/api/sessions",
        json={
            "provider": "openai",
            "model_name": model_name,
            "pricing_model": model_name,
            "system_prompt": (
                "你是一个真实 HITL 联调回归助手。"
                "本轮收到用户消息后，必须先调用 ask_user_question。"
                "问题内容必须是“是否继续真实 HITL 问答联调？”，选项为“继续”和“取消”。"
                "如果用户回答继续，你的最终回复必须原样包含令牌 "
                f"{token}。"
                "除了 ask_user_question，不要调用任何其他工具。"
            ),
            "thinking": {"enabled": False, "effort": None, "verbosity": None},
            "enabled_tools": ["ask_user_question"],
            "human_in_the_loop": True,
            "approval_tool_names": [],
            "max_steps": 16,
            "timeout_seconds": 180,
        },
    )
    create_response.raise_for_status()
    session = create_response.json()
    session_id = session["session_id"]

    send_response = await client.post(
        f"/api/sessions/{session_id}/messages",
        params={"wait": "false"},
        json={"content": "开始真实 HITL 问答联调"},
    )
    send_response.raise_for_status()

    first_detail = await _wait_for_terminal_or_interrupt(
        client,
        session_id,
        timeout_seconds=REAL_HITL_TIMEOUT_SECONDS,
    )
    interrupts = first_detail.get("interrupts") or []
    first_interrupt = interrupts[0] if interrupts else None

    if first_detail["status"] != "interrupted" or first_interrupt is None:
        return case_result(
            name="真实 HITL 用户输入联调",
            started_at=started_at,
            status="failed",
            summary="真实 HITL user_input 联调未进入 interrupted",
            details=[
                f"base_url={base_url}",
                f"session_id={session_id}",
                f"status={first_detail['status']}",
                f"interrupts={json.dumps(interrupts, ensure_ascii=False)}",
            ],
            error="未拿到 user_input interrupt",
        )

    await _resume_interrupt(client, session_id, first_interrupt)
    final_detail = await _wait_for_terminal_or_interrupt(
        client,
        session_id,
        timeout_seconds=REAL_HITL_TIMEOUT_SECONDS,
    )
    assistant_content = ((final_detail.get("last_response") or {}).get("content") or "")
    passed = (
        first_interrupt.get("type") == "user_input"
        and final_detail["status"] == "idle"
        and token in assistant_content
    )

    tracing_status = await client.get(f"/api/sessions/{session_id}/tracing")
    tracing_status.raise_for_status()
    tracing_export = await client.post(f"/api/sessions/{session_id}/tracing/export")
    tracing_export.raise_for_status()
    tracing_payload = tracing_export.json()

    return case_result(
        name="真实 HITL 用户输入联调",
        started_at=started_at,
        status=_bool_status(passed),
        summary="真实 user_input interrupt -> resume -> idle 流程通过" if passed else "真实 user_input 联调未达到预期",
        details=[
            f"base_url={base_url}",
            f"session_id={session_id}",
            f"interrupt_type={first_interrupt.get('type')}",
            f"final_status={final_detail['status']}",
            f"assistant_content={assistant_content!r}",
            f"total_usage={final_detail.get('total_usage')}",
            f"total_cost_usd={final_detail.get('total_cost_usd')}",
        ],
        artifacts=[
            tracing_payload.get("log_dir") or "",
            *[
                str(Path(tracing_payload["log_dir"]) / name)
                for name in tracing_payload.get("files", [])
            ],
        ],
        error=None if passed else "真实 user_input 流程未触发或最终回复缺少令牌",
    )


async def _run_approval_case(
    client: httpx.AsyncClient,
    *,
    base_url: str,
    model_name: str,
) -> SmokeCaseResult:
    started_at = now_iso()
    token = f"REAL_HITL_APPROVAL_OK_{uuid.uuid4().hex[:8]}"
    create_response = await client.post(
        "/api/sessions",
        json={
            "provider": "openai",
            "model_name": model_name,
            "pricing_model": model_name,
            "system_prompt": (
                "你是一个真实 HITL 审批回归助手。"
                "本轮收到请求后，必须只调用 bash 工具执行如下精确命令："
                f"python -c \"print('{token}')\"。"
                "拿到输出后，用一句中文总结，并原样包含该令牌。"
                "不要调用任何其他工具。"
            ),
            "thinking": {"enabled": False, "effort": None, "verbosity": None},
            "enabled_tools": ["bash"],
            "human_in_the_loop": True,
            "approval_tool_names": ["bash"],
            "max_steps": 16,
            "timeout_seconds": 180,
        },
    )
    create_response.raise_for_status()
    session = create_response.json()
    session_id = session["session_id"]

    send_response = await client.post(
        f"/api/sessions/{session_id}/messages",
        params={"wait": "false"},
        json={"content": "开始真实 HITL bash 审批联调"},
    )
    send_response.raise_for_status()

    first_detail = await _wait_for_terminal_or_interrupt(
        client,
        session_id,
        timeout_seconds=REAL_HITL_TIMEOUT_SECONDS,
    )
    interrupts = first_detail.get("interrupts") or []
    first_interrupt = interrupts[0] if interrupts else None

    if first_detail["status"] != "interrupted" or first_interrupt is None:
        return case_result(
            name="真实 HITL 审批联调",
            started_at=started_at,
            status="failed",
            summary="真实 HITL approval 联调未进入 interrupted",
            details=[
                f"base_url={base_url}",
                f"session_id={session_id}",
                f"status={first_detail['status']}",
                f"interrupts={json.dumps(interrupts, ensure_ascii=False)}",
            ],
            error="未拿到 approval interrupt",
        )

    await _resume_interrupt(client, session_id, first_interrupt)
    final_detail = await _wait_for_terminal_or_interrupt(
        client,
        session_id,
        timeout_seconds=REAL_HITL_TIMEOUT_SECONDS,
    )
    assistant_content = ((final_detail.get("last_response") or {}).get("content") or "")
    passed = (
        first_interrupt.get("type") in {"approval", "tool_approval"}
        and final_detail["status"] == "idle"
        and token in assistant_content
    )

    tracing_status = await client.get(f"/api/sessions/{session_id}/tracing")
    tracing_status.raise_for_status()
    tracing_export = await client.post(f"/api/sessions/{session_id}/tracing/export")
    tracing_export.raise_for_status()
    tracing_payload = tracing_export.json()

    return case_result(
        name="真实 HITL 审批联调",
        started_at=started_at,
        status=_bool_status(passed),
        summary="真实 approval interrupt -> resume -> idle 流程通过" if passed else "真实 approval 联调未达到预期",
        details=[
            f"base_url={base_url}",
            f"session_id={session_id}",
            f"interrupt_type={first_interrupt.get('type')}",
            f"final_status={final_detail['status']}",
            f"assistant_content={assistant_content!r}",
            f"total_usage={final_detail.get('total_usage')}",
            f"total_cost_usd={final_detail.get('total_cost_usd')}",
        ],
        artifacts=[
            tracing_payload.get("log_dir") or "",
            *[
                str(Path(tracing_payload["log_dir"]) / name)
                for name in tracing_payload.get("files", [])
            ],
        ],
        error=None if passed else "真实 approval 流程未触发或最终回复缺少令牌",
    )


async def run() -> list[SmokeCaseResult]:
    started_at = now_iso()
    api_port = choose_free_port()
    hitl_port = choose_free_port()
    api_base_url = f"http://127.0.0.1:{api_port}"
    hitl_base_url = f"http://127.0.0.1:{hitl_port}"

    hitl_env = default_smoke_env()
    hitl_env["HITL_HOST"] = "127.0.0.1"
    hitl_env["HITL_PORT"] = str(hitl_port)
    hitl_env["HITL_LOG_LEVEL"] = "warning"

    api_env = default_smoke_env()
    api_env["APP_HOST"] = "127.0.0.1"
    api_env["APP_PORT"] = str(api_port)
    api_env["APP_BACKEND_MODE"] = "hitl"
    api_env["APP_HITL_BASE_URL"] = hitl_base_url

    hitl_process = start_python_process(
        "smoke_real_hitl_server",
        module="apps.hitl",
        env=hitl_env,
    )
    api_process = start_python_process(
        "smoke_real_hitl_api_server",
        module="apps.server",
        env=api_env,
    )

    results: list[SmokeCaseResult] = []
    try:
        await wait_for_http(f"{hitl_base_url}/health", timeout_seconds=30.0)
        await wait_for_http(f"{api_base_url}/health", timeout_seconds=30.0)
        resolved_model, probe_logs = resolve_real_hitl_model(preferred_env_key="SMOKE_REAL_HITL_MODEL_NAME")

        async with httpx.AsyncClient(base_url=api_base_url, timeout=120.0) as client:
            meta_response = await client.get("/api/meta")
            meta_response.raise_for_status()
            meta = meta_response.json()
            health_response = await client.get("/health")
            health_response.raise_for_status()

            ready = (
                meta.get("backend_mode") == "hitl"
                and bool(meta.get("supports_interrupts"))
                and health_response.json().get("status") == "ok"
                and resolved_model is not None
            )
            results.append(
                case_result(
                    name="真实 HITL 服务启动",
                    started_at=started_at,
                    status=_bool_status(ready),
                    summary="统一 API 与独立 HITL server 已联通" if ready else "HITL 服务启动或能力声明异常",
                    details=[
                        f"api_base_url={api_base_url}",
                        f"hitl_base_url={hitl_base_url}",
                        f"meta.backend_mode={meta.get('backend_mode')}",
                        f"meta.supports_interrupts={meta.get('supports_interrupts')}",
                        f"health={health_response.json()}",
                        f"resolved_model={resolved_model}",
                        *probe_logs,
                    ],
                    artifacts=[
                        str(api_process.stdout_path),
                        str(api_process.stderr_path),
                        str(hitl_process.stdout_path),
                        str(hitl_process.stderr_path),
                    ],
                    error=None if ready else "服务未成功进入 hitl backend 模式，或未探测到可用模型",
                )
            )

            if ready:
                results.append(await _run_user_input_case(client, base_url=api_base_url, model_name=resolved_model))
                results.append(await _run_approval_case(client, base_url=api_base_url, model_name=resolved_model))
    finally:
        api_process.terminate()
        hitl_process.terminate()

    return results


def write_results(results: list[SmokeCaseResult]) -> None:
    generated_at = now_iso()
    RESULTS_DOC_PATH.write_text(
        markdown_report("真实 HITL 端到端联调结果", results, generated_at=generated_at),
        encoding="utf-8",
    )
    RESULTS_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_JSON_PATH.write_text(
        json.dumps(
            {
                "generated_at": generated_at,
                "results": [item.to_json_dict() for item in results],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def main() -> None:
    results = asyncio.run(run())
    write_results(results)
    for item in results:
        print(f"[{item.status}] {item.name}: {item.summary}")
    print(f"结果文档：{RESULTS_DOC_PATH}")
    print(f"结果 JSON：{RESULTS_JSON_PATH}")


if __name__ == "__main__":
    main()
