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

RESULTS_DOC_PATH = SMOKE_RUNTIME_DIR / "real-hitl-end-to-end-results.md"
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
    """Wait until a session leaves running and reaches interrupted / idle / error."""

    deadline = asyncio.get_running_loop().time() + timeout_seconds
    while True:
        if asyncio.get_running_loop().time() > deadline:
            raise TimeoutError(f"Timed out waiting for session state change: {session_id}")

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

    question_text = str(payload.get("question") or payload.get("message") or "Continue execution?").strip()
    return {"answers": {question_text: answer_label}}


async def _resume_interrupt(
    client: httpx.AsyncClient,
    session_id: str,
    interrupt: dict[str, Any],
) -> httpx.Response:
    interrupt_type = str(interrupt.get("type") or "")
    if interrupt_type == "user_input":
        value = _extract_answers_payload(interrupt, answer_label="Continue")
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
                "You are a real HITL regression assistant. "
                "When this turn receives the user message, you must first call ask_user_question. "
                "The question text must be \"Continue the real HITL question validation?\" "
                "and options must be \"Continue\" and \"Cancel\". "
                "If the user answers Continue, your final reply must include this token exactly: "
                f"{token}. "
                "Do not call any tool other than ask_user_question."
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
        json={"content": "Start real HITL question validation"},
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
            name="Real HITL user-input validation",
            started_at=started_at,
            status="failed",
            summary="Real HITL user_input validation did not enter interrupted state",
            details=[
                f"base_url={base_url}",
                f"session_id={session_id}",
                f"status={first_detail['status']}",
                f"interrupts={json.dumps(interrupts, ensure_ascii=False)}",
            ],
            error="No user_input interrupt was received",
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
        name="Real HITL user-input validation",
        started_at=started_at,
        status=_bool_status(passed),
        summary="Real user_input interrupt -> resume -> idle flow passed" if passed else "Real user_input validation did not meet expectations",
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
        error=None if passed else "Real user_input flow was not triggered or final reply missed the token",
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
                "You are a real HITL approval regression assistant. "
                "After receiving the request, you must only call the bash tool with this exact command: "
                f"python -c \"print('{token}')\". "
                "After receiving the output, summarize in one short English sentence and include the token exactly. "
                "Do not call any other tool."
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
        json={"content": "Start real HITL bash approval validation"},
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
            name="Real HITL approval validation",
            started_at=started_at,
            status="failed",
            summary="Real HITL approval validation did not enter interrupted state",
            details=[
                f"base_url={base_url}",
                f"session_id={session_id}",
                f"status={first_detail['status']}",
                f"interrupts={json.dumps(interrupts, ensure_ascii=False)}",
            ],
            error="No approval interrupt was received",
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
        name="Real HITL approval validation",
        started_at=started_at,
        status=_bool_status(passed),
        summary="Real approval interrupt -> resume -> idle flow passed" if passed else "Real approval validation did not meet expectations",
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
        error=None if passed else "Real approval flow was not triggered or final reply missed the token",
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
                    name="Real HITL service startup",
                    started_at=started_at,
                    status=_bool_status(ready),
                    summary="Unified API and standalone HITL server are connected" if ready else "HITL service startup or capability declaration failed",
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
                    error=None if ready else "Service did not enter hitl backend mode or no usable model was detected",
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
        markdown_report("Real HITL End-to-End Results", results, generated_at=generated_at),
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
    print(f"results_doc: {RESULTS_DOC_PATH}")
    print(f"results_json: {RESULTS_JSON_PATH}")


if __name__ == "__main__":
    main()
