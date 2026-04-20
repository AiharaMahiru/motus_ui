from __future__ import annotations

import asyncio
import json
import os
import socket
import subprocess
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncIterator

import httpx

from core.config.paths import PROJECT_ROOT, RUNTIME_DIR


SMOKE_RUNTIME_DIR = RUNTIME_DIR / "smoke"
SMOKE_LOG_DIR = SMOKE_RUNTIME_DIR / "logs"
SMOKE_RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
SMOKE_LOG_DIR.mkdir(parents=True, exist_ok=True)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def default_smoke_env() -> dict[str, str]:
    """构造 smoke 测试进程的基础环境变量。"""

    env = os.environ.copy()
    env.setdefault("SMOKE_MODEL_NAME", "gpt-5.4-mini")
    env.setdefault("MOTUS_COLLECTION_LEVEL", "detailed")
    env.setdefault("MOTUS_TRACING_EXPORT", "0")
    env.setdefault("MOTUS_TRACING_ONLINE", "0")
    return env


@dataclass
class SmokeCaseResult:
    """单条 smoke 用例结果。"""

    name: str
    status: str
    summary: str
    started_at: str
    finished_at: str
    duration_seconds: float
    details: list[str] = field(default_factory=list)
    artifacts: list[str] = field(default_factory=list)
    error: str | None = None

    def to_json_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ManagedProcess:
    """后台进程句柄与日志位置。"""

    name: str
    process: subprocess.Popen[Any]
    stdout_path: Path
    stderr_path: Path

    def terminate(self) -> None:
        if self.process.poll() is not None:
            return
        self.process.terminate()
        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait(timeout=5)


def run_shell(command: str, *, timeout_seconds: int = 120, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    """在 zsh 中执行命令并返回完整结果。"""

    return subprocess.run(
        ["zsh", "-lc", command],
        cwd=PROJECT_ROOT,
        env=env or default_smoke_env(),
        text=True,
        capture_output=True,
        timeout=timeout_seconds,
        check=False,
    )


def run_shell_in(
    command: str,
    *,
    cwd: Path,
    timeout_seconds: int = 120,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    """在指定目录执行 shell 命令并返回完整结果。"""

    return subprocess.run(
        ["zsh", "-lc", command],
        cwd=cwd,
        env=env or default_smoke_env(),
        text=True,
        capture_output=True,
        timeout=timeout_seconds,
        check=False,
    )


def choose_free_port() -> int:
    """选择一个当前未被占用的本地端口。"""

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def start_python_process(
    name: str,
    *,
    code: str | None = None,
    module: str | None = None,
    env: dict[str, str] | None = None,
) -> ManagedProcess:
    """启动一个后台 Python 进程，并将日志写入 runtime/smoke/logs。"""

    if not code and not module:
        raise ValueError("code 和 module 至少要提供一个")

    stdout_path = SMOKE_LOG_DIR / f"{name}.stdout.log"
    stderr_path = SMOKE_LOG_DIR / f"{name}.stderr.log"
    stdout_file = stdout_path.open("w", encoding="utf-8")
    stderr_file = stderr_path.open("w", encoding="utf-8")

    if code is not None:
        args = [sys.executable, "-c", code]
    else:
        args = [sys.executable, "-m", module]  # type: ignore[list-item]

    process = subprocess.Popen(
        args,
        cwd=PROJECT_ROOT,
        env=env or default_smoke_env(),
        stdout=stdout_file,
        stderr=stderr_file,
        text=True,
    )
    return ManagedProcess(
        name=name,
        process=process,
        stdout_path=stdout_path,
        stderr_path=stderr_path,
    )


def start_background_process(
    name: str,
    *,
    args: list[str],
    cwd: Path | None = None,
    env: dict[str, str] | None = None,
) -> ManagedProcess:
    """启动任意后台进程，并将日志写入 runtime/smoke/logs。"""

    stdout_path = SMOKE_LOG_DIR / f"{name}.stdout.log"
    stderr_path = SMOKE_LOG_DIR / f"{name}.stderr.log"
    stdout_file = stdout_path.open("w", encoding="utf-8")
    stderr_file = stderr_path.open("w", encoding="utf-8")

    process = subprocess.Popen(
        args,
        cwd=cwd or PROJECT_ROOT,
        env=env or default_smoke_env(),
        stdout=stdout_file,
        stderr=stderr_file,
        text=True,
    )
    return ManagedProcess(
        name=name,
        process=process,
        stdout_path=stdout_path,
        stderr_path=stderr_path,
    )


async def wait_for_http(url: str, *, timeout_seconds: float = 20.0) -> None:
    """轮询 HTTP 服务直到可用。"""

    deadline = time.monotonic() + timeout_seconds
    async with httpx.AsyncClient(timeout=2.0) as client:
        while time.monotonic() < deadline:
            try:
                response = await client.get(url)
                if response.status_code < 500:
                    return
            except Exception:
                pass
            await asyncio.sleep(0.2)
    raise TimeoutError(f"等待 HTTP 服务超时: {url}")


async def collect_sse_events(
    client: httpx.AsyncClient,
    url: str,
    *,
    json_payload: dict[str, Any],
    timeout_seconds: float = 60.0,
) -> list[dict[str, Any]]:
    """读取 SSE 流并解析为事件列表。"""

    events: list[dict[str, Any]] = []
    deadline = time.monotonic() + timeout_seconds

    async with client.stream("POST", url, json=json_payload) as response:
        response.raise_for_status()
        event_name: str | None = None
        data_lines: list[str] = []
        async for raw_line in response.aiter_lines():
            if time.monotonic() > deadline:
                raise TimeoutError(f"SSE 超时: {url}")

            line = raw_line.strip()
            if not line:
                if event_name is not None:
                    payload = {}
                    if data_lines:
                        payload = json.loads("\n".join(data_lines))
                    events.append({"event": event_name, "data": payload})
                event_name = None
                data_lines = []
                continue

            if line.startswith("event:"):
                event_name = line.split(":", 1)[1].strip()
                continue
            if line.startswith("data:"):
                data_lines.append(line.split(":", 1)[1].strip())
                continue

    return events


def case_result(
    *,
    name: str,
    started_at: str,
    summary: str,
    details: list[str] | None = None,
    artifacts: list[str] | None = None,
    error: str | None = None,
    status: str = "passed",
) -> SmokeCaseResult:
    """基于开始时间生成标准化结果对象。"""

    finished_at = now_iso()
    started_dt = datetime.fromisoformat(started_at)
    finished_dt = datetime.fromisoformat(finished_at)
    duration_seconds = (finished_dt - started_dt).total_seconds()
    return SmokeCaseResult(
        name=name,
        status=status,
        summary=summary,
        started_at=started_at,
        finished_at=finished_at,
        duration_seconds=duration_seconds,
        details=details or [],
        artifacts=artifacts or [],
        error=error,
    )


def markdown_report(title: str, results: list[SmokeCaseResult], *, generated_at: str) -> str:
    """把测试结果渲染成 Markdown 文档。"""

    passed = sum(1 for item in results if item.status == "passed")
    failed = sum(1 for item in results if item.status == "failed")
    skipped = sum(1 for item in results if item.status == "skipped")

    lines = [
        f"# {title}",
        "",
        f"- 生成时间：`{generated_at}`",
        f"- 通过：`{passed}`",
        f"- 失败：`{failed}`",
        f"- 跳过：`{skipped}`",
        "",
        "## 结果明细",
        "",
    ]

    for item in results:
        lines.append(f"### {item.name}")
        lines.append("")
        lines.append(f"- 状态：`{item.status}`")
        lines.append(f"- 摘要：{item.summary}")
        lines.append(f"- 开始：`{item.started_at}`")
        lines.append(f"- 结束：`{item.finished_at}`")
        lines.append(f"- 耗时：`{item.duration_seconds:.2f}s`")
        if item.details:
            lines.append("- 现象：")
            for detail in item.details:
                lines.append(f"  - {detail}")
        if item.artifacts:
            lines.append("- 产物：")
            for artifact in item.artifacts:
                lines.append(f"  - `{artifact}`")
        if item.error:
            lines.append(f"- 错误：`{item.error}`")
        lines.append("")

    lines.append("## 原始 JSON")
    lines.append("")
    lines.append("```json")
    lines.append(
        json.dumps(
            [item.to_json_dict() for item in results],
            ensure_ascii=False,
            indent=2,
        )
    )
    lines.append("```")
    lines.append("")
    return "\n".join(lines)
