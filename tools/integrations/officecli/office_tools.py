import asyncio
import json
import os
import shlex
import shutil
from typing import Annotated

from motus.tools import tool

from core.config.env import load_project_env


load_project_env()

OFFICECLI_TIMEOUT_SECONDS = 600.0


def _parse_batch_commands(arguments: str) -> list[str] | None:
    marker = ' --commands "'
    if not arguments.startswith("batch ") or marker not in arguments:
        return None

    head, tail = arguments.split(marker, 1)
    if not tail.endswith('"'):
        return None

    raw_commands = tail[:-1]
    try:
        json.loads(raw_commands)
    except json.JSONDecodeError:
        return None

    head_args = shlex.split(head)
    return [*head_args, "--commands", raw_commands]


def _normalize_arguments(arguments: str) -> list[str]:
    batch_args = _parse_batch_commands(arguments)
    if batch_args is not None:
        return batch_args

    try:
        args = shlex.split(arguments)
    except ValueError as exc:
        raise ValueError(f"无法解析 officecli 参数：{exc}") from exc

    # 兼容旧提示词里常见但当前版本不支持的 create --overwrite 写法。
    if args and args[0] == "create":
        args = [arg for arg in args if arg != "--overwrite"]

    return args

@tool(name="office_cli", description="Execute an officecli command (e.g., 'get doc.docx /') to read/write Office documents. Read tools/integrations/officecli/SKILL.md for syntax rules.")
async def office_cli(
    arguments: Annotated[str, "The arguments to pass to the officecli binary (e.g. 'get report.docx / --json')"],
) -> str:
    officecli_bin = shutil.which(os.getenv("OFFICECLI_BIN", "officecli"))
    if not officecli_bin:
        return "Command execution failed: officecli binary not found in PATH."

    try:
        args = _normalize_arguments(arguments)
    except ValueError as exc:
        return f"Command execution failed: {exc}"

    if not args:
        return "Command execution failed: officecli arguments cannot be empty."

    env = os.environ.copy()
    env.setdefault("OFFICECLI_NO_AUTO_RESIDENT", "1")

    process = await asyncio.create_subprocess_exec(
        officecli_bin,
        *args,
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=OFFICECLI_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        process.kill()
        await process.wait()
        return f"Command execution failed: officecli timed out after {OFFICECLI_TIMEOUT_SECONDS:.0f} seconds."

    stdout_text = stdout.decode('utf-8', errors='replace').strip()
    stderr_text = stderr.decode('utf-8', errors='replace').strip()

    if process.returncode == 0:
        return stdout_text

    error_text = stderr_text or stdout_text or "officecli exited without output"
    return f"Command execution failed with code {process.returncode}: {error_text}"
