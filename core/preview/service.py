from __future__ import annotations

import asyncio
import contextlib
import errno
import os
import pty
import signal
import struct
import sys
import termios
import uuid
from pathlib import Path

from core.config.paths import PROJECT_ROOT
from core.schemas.preview import (
    PreviewArtifact,
    PreviewRunRequest,
    PreviewRunResponse,
    PreviewTerminalInputRequest,
    PreviewTerminalResizeRequest,
    PreviewTerminalState,
)
from core.chat import utc_now_iso
from .artifacts import (
    DEFAULT_PREVIEW_TIMEOUT_SECONDS,
    PREVIEW_ROOT,
    build_preview_file_url,
    detect_html_like_output,
    ensure_safe_relative_path,
    find_python_artifact,
    get_preview_request_manifest_path,
    get_preview_run_dir,
    get_preview_run_manifest_path,
    guess_content_type,
    looks_like_terminal_python_script,
    normalize_preview_language,
)
from .react import (
    VITE_BIN,
    VITE_PLUGIN_REACT,
    WEB_NODE_MODULES,
    build_react_main_source,
    ensure_default_export,
    react_entry_mode,
    react_index_html,
    vite_config_source,
)
from .terminal import (
    TERMINAL_PREVIEW_COLS,
    TERMINAL_PREVIEW_ROWS,
    TerminalPreviewSession,
    TerminalScreenBuffer,
    truncate_text,
)


class PreviewService:
    """统一处理会话内代码预览。"""

    def __init__(self) -> None:
        PREVIEW_ROOT.mkdir(parents=True, exist_ok=True)
        self._terminal_sessions: dict[tuple[str, str], TerminalPreviewSession] = {}
        self._reconcile_terminal_run_manifests()

    def _reconcile_terminal_run_manifests(self) -> None:
        """预处理终端运行清单。

        旧版本在服务重启后会直接把 running 标成 error，导致页面只能看到“已失败”。
        现在保留 running 状态，并在真正访问该 run 时尝试自动重新拉起终端会话。
        """

        for manifest_path in PREVIEW_ROOT.glob("*/*/run.json"):
            with contextlib.suppress(Exception):
                response = PreviewRunResponse.model_validate_json(manifest_path.read_text(encoding="utf-8"))
                if response.mode != "terminal":
                    continue
                if response.status == "running":
                    response.error = None
                    manifest_path.write_text(
                        response.model_dump_json(indent=2, exclude_none=True),
                        encoding="utf-8",
                    )

    async def get_run(self, session_id: str, run_id: str) -> PreviewRunResponse:
        key = (session_id, run_id)
        active_session = self._terminal_sessions.get(key)
        if active_session is not None:
            self._sync_terminal_response(active_session)
            return active_session.response

        manifest_path = get_preview_run_manifest_path(session_id, run_id)
        if not manifest_path.exists():
            raise KeyError(run_id)
        response = PreviewRunResponse.model_validate_json(manifest_path.read_text(encoding="utf-8"))
        if response.mode == "terminal" and response.status == "running":
            response = await self._resume_terminal_run(response)
        return response

    async def write_terminal_input(
        self,
        session_id: str,
        run_id: str,
        request: PreviewTerminalInputRequest,
    ) -> PreviewRunResponse:
        key = (session_id, run_id)
        terminal_session = self._terminal_sessions.get(key)
        if terminal_session is None:
            response = await self.get_run(session_id, run_id)
            if response.mode != "terminal":
                raise RuntimeError("当前预览不是终端模式")
            return response

        if terminal_session.process.returncode is not None:
            self._sync_terminal_response(terminal_session)
            return terminal_session.response

        payload = request.text + ("\n" if request.append_newline else "")
        if "\u0003" in payload and terminal_session.process.returncode is None:
            with contextlib.suppress(ProcessLookupError):
                os.killpg(terminal_session.process.pid, signal.SIGINT)
            payload = payload.replace("\u0003", "")
        if payload:
            os.write(terminal_session.master_fd, payload.encode("utf-8", errors="replace"))
            await asyncio.sleep(0.06)

        self._sync_terminal_response(terminal_session)
        self._persist_run(terminal_session.response)
        return terminal_session.response

    async def terminate_run(self, session_id: str, run_id: str) -> PreviewRunResponse:
        key = (session_id, run_id)
        terminal_session = self._terminal_sessions.get(key)
        if terminal_session is None:
            return await self.get_run(session_id, run_id)

        if terminal_session.process.returncode is None:
            terminal_session.terminated_by_user = True
            with contextlib.suppress(ProcessLookupError):
                os.killpg(terminal_session.process.pid, signal.SIGTERM)
            try:
                await asyncio.wait_for(terminal_session.process.wait(), timeout=1.5)
            except asyncio.TimeoutError:
                with contextlib.suppress(ProcessLookupError):
                    os.killpg(terminal_session.process.pid, signal.SIGKILL)
                await terminal_session.process.wait()

        if terminal_session.reader_task is not None:
            await terminal_session.reader_task

        return await self.get_run(session_id, run_id)

    async def resize_terminal(
        self,
        session_id: str,
        run_id: str,
        request: PreviewTerminalResizeRequest,
    ) -> PreviewRunResponse:
        key = (session_id, run_id)
        terminal_session = self._terminal_sessions.get(key)
        if terminal_session is None:
            response = await self.get_run(session_id, run_id)
            if response.mode != "terminal":
                raise RuntimeError("当前预览不是终端模式")
            return response

        self._set_terminal_size(terminal_session.master_fd, request.cols, request.rows)
        terminal_session.screen.resize(request.cols, request.rows)
        self._sync_terminal_response(terminal_session)
        self._persist_run(terminal_session.response)
        return terminal_session.response

    async def run_preview(
        self,
        *,
        session_id: str,
        request: PreviewRunRequest,
        timeout_seconds: float | None = None,
    ) -> PreviewRunResponse:
        run_id = uuid.uuid4().hex[:12]
        created_at = utc_now_iso()
        run_dir = get_preview_run_dir(session_id, run_id)
        run_dir.mkdir(parents=True, exist_ok=True)
        normalized_language = normalize_preview_language(request.language)
        effective_timeout = float(timeout_seconds or DEFAULT_PREVIEW_TIMEOUT_SECONDS)
        self._persist_request(session_id, run_id, request)

        response = PreviewRunResponse(
            run_id=run_id,
            session_id=session_id,
            language=request.language,
            normalized_language=normalized_language,  # type: ignore[arg-type]
            status="completed",
            title=request.title,
            created_at=created_at,
            completed_at=None,
            command=None,
            run_dir=str(run_dir),
            source_file="",
            artifact=None,
            stdout=None,
            stderr=None,
            error=None,
        )

        try:
            if normalized_language == "html":
                response = await self._run_html_preview(
                    response=response,
                    code=request.code,
                )
            elif normalized_language == "react":
                response = await self._run_react_preview(
                    response=response,
                    code=request.code,
                    timeout_seconds=effective_timeout,
                )
            else:
                response = await self._run_python_preview(
                    response=response,
                    code=request.code,
                    timeout_seconds=effective_timeout,
                )
        except Exception as exc:
            response.status = "error"
            response.error = str(exc)
        finally:
            if response.status != "running":
                response.completed_at = utc_now_iso()
            self._persist_run(response)

        return response

    def resolve_artifact_path(self, session_id: str, run_id: str, file_path: str) -> Path:
        run_dir = get_preview_run_dir(session_id, run_id).resolve()
        candidate = (run_dir / file_path).resolve()
        candidate.relative_to(run_dir)
        if not candidate.exists() or not candidate.is_file():
            raise FileNotFoundError(file_path)
        return candidate

    def _persist_run(self, response: PreviewRunResponse) -> None:
        manifest_path = get_preview_run_manifest_path(response.session_id, response.run_id)
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(
            response.model_dump_json(indent=2, exclude_none=True),
            encoding="utf-8",
        )

    def _persist_request(self, session_id: str, run_id: str, request: PreviewRunRequest) -> None:
        request_path = get_preview_request_manifest_path(session_id, run_id)
        request_path.parent.mkdir(parents=True, exist_ok=True)
        request_path.write_text(
            request.model_dump_json(indent=2, exclude_none=True),
            encoding="utf-8",
        )

    def _load_persisted_request(self, session_id: str, run_id: str) -> PreviewRunRequest | None:
        request_path = get_preview_request_manifest_path(session_id, run_id)
        if not request_path.exists():
            return None
        try:
            return PreviewRunRequest.model_validate_json(request_path.read_text(encoding="utf-8"))
        except Exception:
            return None

    async def _resume_terminal_run(self, response: PreviewRunResponse) -> PreviewRunResponse:
        """在服务重启后自动重新拉起终端预览。

        真正的 PTY 句柄无法跨进程恢复，所以这里采用“按原始请求自动重跑”的恢复策略。
        对用户来说，预览面板仍可继续交互，而不是永远停留在错误态。
        """

        key = (response.session_id, response.run_id)
        if key in self._terminal_sessions:
            return self._terminal_sessions[key].response

        request = self._load_persisted_request(response.session_id, response.run_id)
        code = request.code if request is not None else ""
        if not code:
            source_path = Path(response.run_dir) / response.source_file
            if source_path.exists():
                code = source_path.read_text(encoding="utf-8")

        if not code:
            response.status = "error"
            response.completed_at = utc_now_iso()
            response.error = "终端预览无法恢复：缺少原始代码或请求快照。"
            self._persist_run(response)
            return response

        response.completed_at = None
        response.error = None
        response.stdout = None
        response.stderr = None
        response.terminal = None
        return await self._run_python_terminal_preview(
            response=response,
            code=code,
        )

    def _set_terminal_size(self, fd: int, cols: int, rows: int) -> None:
        with contextlib.suppress(OSError):
            import fcntl

            winsize = struct.pack("HHHH", rows, cols, 0, 0)
            termios_fcntl = getattr(termios, "TIOCSWINSZ", None)
            if termios_fcntl is not None:
                fcntl.ioctl(fd, termios_fcntl, winsize)

    def _sync_terminal_response(self, terminal_session: TerminalPreviewSession) -> None:
        terminal_session.response.terminal = PreviewTerminalState(
            cols=terminal_session.screen.cols,
            rows=terminal_session.screen.rows,
            screen_text=terminal_session.screen.render(),
            transcript_tail=truncate_text(terminal_session.transcript_tail),
            can_write_stdin=terminal_session.process.returncode is None,
            exit_code=terminal_session.process.returncode,
        )

    async def _pump_terminal_session(self, terminal_session: TerminalPreviewSession) -> None:
        key = (terminal_session.response.session_id, terminal_session.response.run_id)

        try:
            while True:
                try:
                    chunk = await asyncio.to_thread(os.read, terminal_session.master_fd, 4096)
                except OSError as exc:
                    if exc.errno == errno.EIO:
                        break
                    raise

                if not chunk:
                    break

                decoded = chunk.decode("utf-8", errors="replace")
                terminal_session.transcript_tail = (terminal_session.transcript_tail + decoded)[-30_000:]
                terminal_session.screen.feed(decoded)
                self._sync_terminal_response(terminal_session)
                self._persist_run(terminal_session.response)
        finally:
            return_code = await terminal_session.process.wait()
            self._sync_terminal_response(terminal_session)
            terminal_session.response.completed_at = utc_now_iso()
            if return_code == 0 or terminal_session.terminated_by_user:
                terminal_session.response.status = "completed"
                terminal_session.response.error = None
            else:
                terminal_session.response.status = "error"
                terminal_session.response.error = (
                    terminal_session.response.error
                    or f"终端进程退出，exit code={return_code}"
                )
            self._persist_run(terminal_session.response)
            self._terminal_sessions.pop(key, None)
            with contextlib.suppress(OSError):
                os.close(terminal_session.master_fd)

    async def _run_python_terminal_preview(
        self,
        *,
        response: PreviewRunResponse,
        code: str,
    ) -> PreviewRunResponse:
        run_dir = Path(response.run_dir)
        source_path = run_dir / "main.py"
        source_path.write_text(code, encoding="utf-8")

        master_fd, slave_fd = pty.openpty()
        self._set_terminal_size(slave_fd, TERMINAL_PREVIEW_COLS, TERMINAL_PREVIEW_ROWS)

        process = await asyncio.create_subprocess_exec(
            sys.executable,
            source_path.name,
            cwd=str(run_dir),
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            start_new_session=True,
            env={
                **os.environ,
                "AGENT_PREVIEW_DIR": str(run_dir),
                "AGENT_PROJECT_ROOT": str(PROJECT_ROOT),
                "TERM": "xterm-256color",
                "PYTHONUNBUFFERED": "1",
            },
        )
        os.close(slave_fd)

        response.mode = "terminal"
        response.status = "running"
        response.source_file = source_path.name
        response.command = f"{sys.executable} {source_path.name}"

        terminal_session = TerminalPreviewSession(
            response=response,
            process=process,
            master_fd=master_fd,
            screen=TerminalScreenBuffer(),
        )
        self._sync_terminal_response(terminal_session)
        terminal_session.reader_task = asyncio.create_task(self._pump_terminal_session(terminal_session))
        self._terminal_sessions[(response.session_id, response.run_id)] = terminal_session
        return response

    async def _run_html_preview(
        self,
        *,
        response: PreviewRunResponse,
        code: str,
    ) -> PreviewRunResponse:
        run_dir = Path(response.run_dir)
        source_path = run_dir / "preview.html"
        source_path.write_text(code, encoding="utf-8")
        artifact_relative = ensure_safe_relative_path(source_path, run_dir)
        response.source_file = source_path.name
        response.artifact = PreviewArtifact(
            kind="html",
            file_name=source_path.name,
            content_type="text/html",
            url=build_preview_file_url(response.session_id, response.run_id, artifact_relative),
        )
        return response

    async def _run_react_preview(
        self,
        *,
        response: PreviewRunResponse,
        code: str,
        timeout_seconds: float,
    ) -> PreviewRunResponse:
        if not VITE_BIN.exists():
            raise RuntimeError("当前环境缺少 Vite，本地 React 预览不可用")
        if not VITE_PLUGIN_REACT.exists():
            raise RuntimeError("当前环境缺少 @vitejs/plugin-react，本地 React 预览不可用")

        run_dir = Path(response.run_dir)
        src_dir = run_dir / "src"
        src_dir.mkdir(parents=True, exist_ok=True)

        source_path = src_dir / "UserPreview.tsx"
        prepared_source = code if react_entry_mode(code) == "self-mounted" else ensure_default_export(code)
        source_path.write_text(prepared_source, encoding="utf-8")
        main_path = src_dir / "main.tsx"
        main_path.write_text(build_react_main_source(code), encoding="utf-8")
        index_path = run_dir / "index.html"
        index_path.write_text(react_index_html(), encoding="utf-8")
        config_path = run_dir / "vite.config.mjs"
        config_path.write_text(vite_config_source(), encoding="utf-8")
        node_modules_link = run_dir / "node_modules"
        if not node_modules_link.exists():
            node_modules_link.symlink_to(WEB_NODE_MODULES, target_is_directory=True)

        response.source_file = ensure_safe_relative_path(source_path, run_dir)
        response.command = f"node {VITE_BIN} build --config {config_path.name} --logLevel error"

        process = await asyncio.create_subprocess_exec(
            "node",
            str(VITE_BIN),
            "build",
            "--config",
            config_path.name,
            "--logLevel",
            "error",
            cwd=str(run_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={**os.environ, "NODE_ENV": "production"},
        )
        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(process.communicate(), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            process.kill()
            await process.communicate()
            raise RuntimeError(f"React 预览构建超时（>{int(timeout_seconds)}s）")

        stdout = truncate_text(stdout_bytes.decode("utf-8", errors="replace"))
        stderr = truncate_text(stderr_bytes.decode("utf-8", errors="replace"))
        response.stdout = stdout
        response.stderr = stderr
        if process.returncode != 0:
            response.status = "error"
            response.error = stderr or stdout or "React 预览构建失败"
            return response

        artifact_path = run_dir / "dist" / "index.html"
        if not artifact_path.exists():
            response.status = "error"
            response.error = "React 预览构建完成，但没有生成 index.html"
            return response

        artifact_relative = ensure_safe_relative_path(artifact_path, run_dir)
        response.artifact = PreviewArtifact(
            kind="html",
            file_name=artifact_path.name,
            content_type="text/html",
            url=build_preview_file_url(response.session_id, response.run_id, artifact_relative),
        )
        return response

    async def _run_python_preview(
        self,
        *,
        response: PreviewRunResponse,
        code: str,
        timeout_seconds: float,
    ) -> PreviewRunResponse:
        if looks_like_terminal_python_script(code):
            return await self._run_python_terminal_preview(
                response=response,
                code=code,
            )

        run_dir = Path(response.run_dir)
        source_path = run_dir / "main.py"
        source_path.write_text(code, encoding="utf-8")
        response.source_file = source_path.name
        response.command = f"{sys.executable} {source_path.name}"

        process = await asyncio.create_subprocess_exec(
            sys.executable,
            source_path.name,
            cwd=str(run_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={
                **os.environ,
                "AGENT_PREVIEW_DIR": str(run_dir),
                "AGENT_PROJECT_ROOT": str(PROJECT_ROOT),
            },
        )
        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(process.communicate(), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            process.kill()
            await process.communicate()
            raise RuntimeError(f"Python 预览执行超时（>{int(timeout_seconds)}s）")

        stdout = truncate_text(stdout_bytes.decode("utf-8", errors="replace"))
        stderr = truncate_text(stderr_bytes.decode("utf-8", errors="replace"))
        response.stdout = stdout
        response.stderr = stderr

        html_from_stdout = detect_html_like_output(stdout)
        if html_from_stdout is not None:
            file_name, html_content = html_from_stdout
            stdout_artifact_path = run_dir / file_name
            stdout_artifact_path.write_text(html_content, encoding="utf-8")

        artifact_path = find_python_artifact(run_dir)
        if artifact_path is not None:
            artifact_relative = ensure_safe_relative_path(artifact_path, run_dir)
            content_type = guess_content_type(artifact_path)
            artifact_kind = "image" if artifact_path.suffix.lower() in {".png", ".svg"} else "html"
            response.artifact = PreviewArtifact(
                kind=artifact_kind,  # type: ignore[arg-type]
                file_name=artifact_path.name,
                content_type=content_type,
                url=build_preview_file_url(response.session_id, response.run_id, artifact_relative),
            )

        if process.returncode != 0:
            response.status = "error"
            response.error = stderr or stdout or "Python 预览执行失败"
            return response

        return response
