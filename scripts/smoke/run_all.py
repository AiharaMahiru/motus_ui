from __future__ import annotations

import asyncio
import importlib
import json
import os
from pathlib import Path
from typing import Awaitable, Callable

from scripts.smoke.common import (
    PROJECT_ROOT,
    SMOKE_RUNTIME_DIR,
    SmokeCaseResult,
    case_result,
    markdown_report,
    now_iso,
    run_shell,
)


RESULTS_DOC_PATH = PROJECT_ROOT / "docs" / "system-smoke-test-results.md"
RESULTS_JSON_PATH = SMOKE_RUNTIME_DIR / "system-smoke-test-results.json"


async def _run_static_checks() -> list[SmokeCaseResult]:
    started_at = now_iso()
    compile_result = run_shell("uv run python -m py_compile apps/*.py core/**/*.py tools/**/*.py")
    import_result = run_shell(
        "uv run python - <<'PY'\n"
        "import apps.server\n"
        "import apps.tui\n"
        "import apps.hitl\n"
        "print('imports-ok')\n"
        "PY"
    )

    passed = compile_result.returncode == 0 and import_result.returncode == 0
    return [
        case_result(
            name="静态与入口校验",
            started_at=started_at,
            status="passed" if passed else "failed",
            summary="语法编译和入口模块导入通过" if passed else "语法编译或入口模块导入失败",
            details=[
                f"py_compile.returncode={compile_result.returncode}",
                f"imports.returncode={import_result.returncode}",
                f"imports.stdout={import_result.stdout.strip()!r}",
                f"py_compile.stderr={compile_result.stderr.strip()!r}",
                f"imports.stderr={import_result.stderr.strip()!r}",
            ],
            error=None if passed else "静态检查未通过",
        )
    ]


async def _run_script_module(module_name: str) -> list[SmokeCaseResult]:
    module = importlib.import_module(module_name)
    runner = getattr(module, "run")
    result = runner()
    if asyncio.iscoroutine(result):
        return await result
    return result


async def _run_with_capture(name: str, module_name: str) -> list[SmokeCaseResult]:
    try:
        return await _run_script_module(module_name)
    except Exception as exc:
        return [
            case_result(
                name=name,
                started_at=now_iso(),
                status="failed",
                summary=f"{name} 在执行过程中抛出异常",
                error=f"{type(exc).__name__}: {exc}",
            )
        ]


async def run_all() -> list[SmokeCaseResult]:
    results: list[SmokeCaseResult] = []
    results.extend(await _run_static_checks())
    results.extend(await _run_with_capture("本地 backend smoke", "scripts.smoke.local_backend"))
    results.extend(await _run_with_capture("workflow tracing smoke", "scripts.smoke.workflow_tracing"))
    results.extend(await _run_with_capture("HTTP API smoke", "scripts.smoke.http_api"))
    results.extend(await _run_with_capture("WebUI smoke", "scripts.smoke.webui"))
    results.extend(await _run_with_capture("HITL demo smoke", "scripts.smoke.hitl_demo"))
    if os.getenv("SMOKE_INCLUDE_REAL_HITL_WEBUI", "0") == "1":
        results.extend(await _run_with_capture("真实 HITL WebUI smoke", "scripts.smoke.hitl_real_webui"))
    results.extend(await _run_with_capture("TUI smoke", "scripts.smoke.tui_smoke"))
    results.extend(await _run_with_capture("外部依赖 smoke", "scripts.smoke.external_tools"))
    return results


def write_results(results: list[SmokeCaseResult]) -> None:
    generated_at = now_iso()
    RESULTS_DOC_PATH.write_text(
        markdown_report("系统级 Smoke Test 结果", results, generated_at=generated_at),
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
    results = asyncio.run(run_all())
    write_results(results)
    for item in results:
        print(f"[{item.status}] {item.name}: {item.summary}")
    print(f"结果文档：{RESULTS_DOC_PATH}")
    print(f"结果 JSON：{RESULTS_JSON_PATH}")


if __name__ == "__main__":
    main()
