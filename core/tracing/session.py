from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Literal

from motus.runtime import get_runtime
from motus.runtime.hooks import HookEvent, register_hook

from core.config.paths import PROJECT_ROOT, SESSION_TRACES_DIR, WORKFLOW_TRACES_DIR


@dataclass(frozen=True)
class TraceScopeContext:
    """当前调用链绑定的 tracing 作用域。"""

    scope: Literal["session", "workflow"]
    scope_id: str
    project_root: Path
    log_dir: Path


_CURRENT_TRACE_CONTEXT: ContextVar[TraceScopeContext | None] = ContextVar(
    "current_trace_context",
    default=None,
)
_HOOK_REGISTERED = False


def get_session_trace_dir(session_id: str) -> Path:
    """返回某个 session 的 trace 输出目录。"""

    return SESSION_TRACES_DIR / session_id


def get_workflow_trace_dir(run_id: str) -> Path:
    """返回某个 workflow run 的 trace 输出目录。"""

    return WORKFLOW_TRACES_DIR / run_id


def _annotate_scope_metadata(event: HookEvent) -> None:
    """把当前 tracing 作用域元数据补写到 Motus span 上。

    Motus 默认只知道一个 runtime tracer，不知道“当前是哪个会话”。
    这里借助 contextvar，在 task_start 时把 scope 相关信息写回 tracer.task_meta，
    后续就可以按 session 或 workflow run 精确过滤导出。
    """

    if event.task_id is None:
        return

    context = _CURRENT_TRACE_CONTEXT.get()
    if context is None:
        return

    tracer = get_runtime().scheduler.tracer
    meta = tracer.task_meta.get(event.task_id.id)
    if meta is None:
        return

    meta["project_root"] = str(context.project_root)
    meta["trace_scope"] = context.scope
    meta["trace_scope_id"] = context.scope_id
    meta["trace_log_dir"] = str(context.log_dir)

    if context.scope == "session":
        meta["session_id"] = context.scope_id
        meta["session_trace_dir"] = str(context.log_dir)
    elif context.scope == "workflow":
        meta["workflow_run_id"] = context.scope_id
        meta["workflow_trace_dir"] = str(context.log_dir)


def _ensure_scope_trace_hook() -> None:
    """确保全局 tracing scope hook 只注册一次。"""

    global _HOOK_REGISTERED
    if _HOOK_REGISTERED:
        return

    # 这里不使用 prepend，确保 tracer.on_task_start 先创建 task_meta，
    # 我们再把 scope 级元数据补写进去。
    register_hook("task_start", _annotate_scope_metadata)
    _HOOK_REGISTERED = True


@contextmanager
def _trace_scope(
    scope: Literal["session", "workflow"],
    scope_id: str,
    log_dir: Path,
) -> Iterator[TraceScopeContext]:
    """进入某个 tracing 作用域。"""

    _ensure_scope_trace_hook()
    context = TraceScopeContext(
        scope=scope,
        scope_id=scope_id,
        project_root=PROJECT_ROOT,
        log_dir=log_dir,
    )
    context.log_dir.mkdir(parents=True, exist_ok=True)

    token = _CURRENT_TRACE_CONTEXT.set(context)
    try:
        yield context
    finally:
        _CURRENT_TRACE_CONTEXT.reset(token)


@contextmanager
def session_trace_scope(session_id: str) -> Iterator[TraceScopeContext]:
    """进入某个 session 的 tracing 作用域。"""

    with _trace_scope(
        "session",
        session_id,
        get_session_trace_dir(session_id),
    ) as context:
        yield context


@contextmanager
def workflow_trace_scope(run_id: str) -> Iterator[TraceScopeContext]:
    """进入某个 workflow run 的 tracing 作用域。"""

    with _trace_scope(
        "workflow",
        run_id,
        get_workflow_trace_dir(run_id),
    ) as context:
        yield context
