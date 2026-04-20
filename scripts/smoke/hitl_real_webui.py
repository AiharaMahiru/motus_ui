from __future__ import annotations

import asyncio
import json
from pathlib import Path

from scripts.smoke.common import (
    PROJECT_ROOT,
    SMOKE_RUNTIME_DIR,
    SmokeCaseResult,
    case_result,
    choose_free_port,
    default_smoke_env,
    markdown_report,
    now_iso,
    run_shell_in,
    start_background_process,
    start_python_process,
    wait_for_http,
)
from scripts.smoke.hitl_real_support import resolve_real_hitl_model


WEB_DIR = PROJECT_ROOT / "web"
RESULTS_DOC_PATH = PROJECT_ROOT / "docs" / "真实-HITL-WebUI-联调结果.md"
RESULTS_JSON_PATH = SMOKE_RUNTIME_DIR / "real-hitl-webui-results.json"


async def run() -> list[SmokeCaseResult]:
    results: list[SmokeCaseResult] = []
    started_at = now_iso()
    api_port = choose_free_port()
    hitl_port = choose_free_port()
    web_port = choose_free_port()
    api_base_url = f"http://127.0.0.1:{api_port}"
    hitl_base_url = f"http://127.0.0.1:{hitl_port}"
    web_base_url = f"http://127.0.0.1:{web_port}"
    resolved_model, probe_logs = resolve_real_hitl_model(preferred_env_key="SMOKE_REAL_HITL_MODEL_NAME")

    if resolved_model is None:
        return [
            case_result(
                name="真实 HITL WebUI 联调",
                started_at=started_at,
                status="failed",
                summary="未探测到可用真实模型，无法执行真实 WebUI HITL 联调",
                details=probe_logs,
                error="模型探测失败",
            )
        ]

    hitl_env = default_smoke_env()
    hitl_env["HITL_HOST"] = "127.0.0.1"
    hitl_env["HITL_PORT"] = str(hitl_port)
    hitl_env["HITL_LOG_LEVEL"] = "warning"

    api_env = default_smoke_env()
    api_env["APP_HOST"] = "127.0.0.1"
    api_env["APP_PORT"] = str(api_port)
    api_env["APP_BACKEND_MODE"] = "hitl"
    api_env["APP_HITL_BASE_URL"] = hitl_base_url

    web_env = default_smoke_env()
    web_env["APP_HOST"] = "127.0.0.1"
    web_env["APP_PORT"] = str(api_port)
    web_env["PLAYWRIGHT_EXTERNAL_SERVERS"] = "1"
    web_env["PLAYWRIGHT_BASE_URL"] = web_base_url

    playwright_env = {
        **web_env,
        "PLAYWRIGHT_REAL_HITL": "1",
        "PLAYWRIGHT_REAL_HITL_MODEL": resolved_model,
    }

    hitl_process = start_python_process(
        "smoke_real_hitl_webui_server",
        module="apps.hitl",
        env=hitl_env,
    )
    api_process = start_python_process(
        "smoke_real_hitl_webui_api_server",
        module="apps.server",
        env=api_env,
    )
    web_process = start_background_process(
        "smoke_real_hitl_webui_vite_server",
        args=["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", str(web_port)],
        cwd=WEB_DIR,
        env=web_env,
    )

    try:
        await wait_for_http(f"{hitl_base_url}/health", timeout_seconds=30.0)
        await wait_for_http(f"{api_base_url}/health", timeout_seconds=30.0)
        await wait_for_http(web_base_url, timeout_seconds=30.0)

        e2e_result = run_shell_in(
            "npx playwright test tests/e2e/hitl-real.spec.ts --project=chromium",
            cwd=WEB_DIR,
            timeout_seconds=1200,
            env=playwright_env,
        )
        passed = e2e_result.returncode == 0
        results.append(
            case_result(
                name="真实 HITL WebUI 联调",
                started_at=started_at,
                status="passed" if passed else "failed",
                summary="真实 HITL WebUI user_input / approval 页面闭环通过" if passed else "真实 HITL WebUI 联调未通过",
                details=[
                    f"api_base_url={api_base_url}",
                    f"hitl_base_url={hitl_base_url}",
                    f"web_base_url={web_base_url}",
                    f"resolved_model={resolved_model}",
                    *probe_logs,
                    f"returncode={e2e_result.returncode}",
                    f"stdout_tail={e2e_result.stdout.strip()[-1200:]}",
                    f"stderr_tail={e2e_result.stderr.strip()[-1200:]}",
                ],
                artifacts=[
                    str(hitl_process.stdout_path),
                    str(hitl_process.stderr_path),
                    str(api_process.stdout_path),
                    str(api_process.stderr_path),
                    str(web_process.stdout_path),
                    str(web_process.stderr_path),
                    str(WEB_DIR / "test-results"),
                ],
                error=None if passed else "真实 HITL WebUI Playwright 执行失败",
            )
        )
    finally:
        hitl_process.terminate()
        api_process.terminate()
        web_process.terminate()

    return results


def write_results(results: list[SmokeCaseResult]) -> None:
    generated_at = now_iso()
    RESULTS_DOC_PATH.write_text(
        markdown_report("真实 HITL WebUI 联调结果", results, generated_at=generated_at),
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
