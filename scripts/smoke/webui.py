from __future__ import annotations

import asyncio
from pathlib import Path

from scripts.smoke.common import (
    PROJECT_ROOT,
    SmokeCaseResult,
    case_result,
    choose_free_port,
    default_smoke_env,
    now_iso,
    run_shell_in,
    start_background_process,
    start_python_process,
    wait_for_http,
)


WEB_DIR = PROJECT_ROOT / "web"


async def run() -> list[SmokeCaseResult]:
    results: list[SmokeCaseResult] = []

    build_started_at = now_iso()
    build_result = run_shell_in("npm run build", cwd=WEB_DIR, timeout_seconds=300)
    build_passed = build_result.returncode == 0
    results.append(
        case_result(
            name="WebUI 构建",
            started_at=build_started_at,
            status="passed" if build_passed else "failed",
            summary="WebUI 构建通过" if build_passed else "WebUI 构建失败",
            details=[
                f"returncode={build_result.returncode}",
                f"stdout_tail={build_result.stdout.strip()[-400:]}",
                f"stderr_tail={build_result.stderr.strip()[-400:]}",
            ],
            error=None if build_passed else "npm run build 未通过",
        )
    )
    if not build_passed:
        return results

    started_at = now_iso()
    api_port = choose_free_port()
    web_port = choose_free_port()
    api_base_url = f"http://127.0.0.1:{api_port}"
    web_base_url = f"http://127.0.0.1:{web_port}"

    api_env = default_smoke_env()
    api_env["APP_HOST"] = "127.0.0.1"
    api_env["APP_PORT"] = str(api_port)

    web_env = default_smoke_env()
    web_env["APP_HOST"] = "127.0.0.1"
    web_env["APP_PORT"] = str(api_port)
    web_env["PLAYWRIGHT_EXTERNAL_SERVERS"] = "1"
    web_env["PLAYWRIGHT_BASE_URL"] = web_base_url

    api_process = start_python_process(
        "smoke_webui_api_server",
        module="apps.server",
        env=api_env,
    )
    web_process = start_background_process(
        "smoke_webui_vite_server",
        args=["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", str(web_port)],
        cwd=WEB_DIR,
        env=web_env,
    )

    try:
        await wait_for_http(f"{api_base_url}/health")
        await wait_for_http(web_base_url, timeout_seconds=30.0)

        e2e_result = run_shell_in(
            "npm run e2e",
            cwd=WEB_DIR,
            timeout_seconds=600,
            env=web_env,
        )
        passed = e2e_result.returncode == 0
        results.append(
            case_result(
                name="WebUI E2E",
                started_at=started_at,
                status="passed" if passed else "failed",
                summary="WebUI 真实页面链路通过" if passed else "WebUI E2E 未通过",
                details=[
                    f"api_base_url={api_base_url}",
                    f"web_base_url={web_base_url}",
                    f"returncode={e2e_result.returncode}",
                    f"stdout_tail={e2e_result.stdout.strip()[-800:]}",
                    f"stderr_tail={e2e_result.stderr.strip()[-800:]}",
                ],
                artifacts=[
                    str(api_process.stdout_path),
                    str(api_process.stderr_path),
                    str(web_process.stdout_path),
                    str(web_process.stderr_path),
                    str(WEB_DIR / "test-results"),
                ],
                error=None if passed else "Playwright E2E 执行失败",
            )
        )
    finally:
        api_process.terminate()
        web_process.terminate()

    return results


def main() -> None:
    results = asyncio.run(run())
    for item in results:
        print(f"[{item.status}] {item.name}: {item.summary}")


if __name__ == "__main__":
    main()
