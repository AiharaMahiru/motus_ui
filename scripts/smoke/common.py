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
    """Build the base environment for smoke-test subprocesses."""

    env = os.environ.copy()
    env.setdefault("SMOKE_MODEL_NAME", "gpt-5.4-mini")
    env.setdefault("MOTUS_COLLECTION_LEVEL", "detailed")
    env.setdefault("MOTUS_TRACING_EXPORT", "0")
    env.setdefault("MOTUS_TRACING_ONLINE", "0")
    return env


@dataclass
class SmokeCaseResult:
    """Result for one smoke-test case."""

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
    """Background process handle and log paths."""

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
    """Run a shell command through zsh and return the full result."""

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
    """Run a shell command in a specific working directory and return the full result."""

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
    """Choose an available local port."""

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
    """Start a background Python process and write logs under runtime/smoke/logs."""

    if not code and not module:
        raise ValueError("Either code or module must be provided")

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
    """Start a background process and write logs under runtime/smoke/logs."""

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
    """Poll an HTTP endpoint until it becomes available."""

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
    raise TimeoutError(f"Timed out waiting for HTTP service: {url}")


async def collect_sse_events(
    client: httpx.AsyncClient,
    url: str,
    *,
    json_payload: dict[str, Any],
    timeout_seconds: float = 60.0,
) -> list[dict[str, Any]]:
    """Read an SSE stream and return parsed events."""

    events: list[dict[str, Any]] = []
    deadline = time.monotonic() + timeout_seconds

    async with client.stream("POST", url, json=json_payload) as response:
        response.raise_for_status()
        event_name: str | None = None
        data_lines: list[str] = []
        async for raw_line in response.aiter_lines():
            if time.monotonic() > deadline:
                raise TimeoutError(f"SSE timed out: {url}")

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
    """Build a normalized smoke-test result from the start time."""

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
    """Render smoke-test results as Markdown."""

    passed = sum(1 for item in results if item.status == "passed")
    failed = sum(1 for item in results if item.status == "failed")
    skipped = sum(1 for item in results if item.status == "skipped")

    lines = [
        f"# {title}",
        "",
        f"- Generated at: `{generated_at}`",
        f"- Passed: `{passed}`",
        f"- Failed: `{failed}`",
        f"- Skipped: `{skipped}`",
        "",
        "## Result Details",
        "",
    ]

    for item in results:
        lines.append(f"### {item.name}")
        lines.append("")
        lines.append(f"- Status: `{item.status}`")
        lines.append(f"- Summary: {item.summary}")
        lines.append(f"- Started: `{item.started_at}`")
        lines.append(f"- Finished: `{item.finished_at}`")
        lines.append(f"- Duration: `{item.duration_seconds:.2f}s`")
        if item.details:
            lines.append("- Observations:")
            for detail in item.details:
                lines.append(f"  - {detail}")
        if item.artifacts:
            lines.append("- Artifacts:")
            for artifact in item.artifacts:
                lines.append(f"  - `{artifact}`")
        if item.error:
            lines.append(f"- Error: `{item.error}`")
        lines.append("")

    lines.append("## Raw JSON")
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
