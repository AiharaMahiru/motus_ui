from __future__ import annotations

from copy import deepcopy
from pathlib import Path

from motus.runtime import get_runtime
from motus.runtime.tracing.exporters import (
    CompositeExporter,
    HTMLViewerExporter,
    JSONStateExporter,
    JaegerExporter,
)

from core.config.env import load_project_env
from core.config.paths import PROJECT_ROOT
from core.schemas.tracing import TraceExportResult, TracingConfigSummary, TracingStatus
from core.tracing import get_session_trace_dir, get_workflow_trace_dir


load_project_env()


class TracingService:
    """统一的 tracing 查询与导出服务。"""

    def _runtime(self):
        return get_runtime()

    def _tracer(self):
        return self._runtime().scheduler.tracer

    def _resolve_log_dir(self) -> Path:
        return Path(self._tracer().config.log_dir).resolve()

    def _resolve_scope_log_dir(
        self,
        *,
        session_id: str | None = None,
        workflow_run_id: str | None = None,
    ) -> Path:
        if workflow_run_id is not None:
            return get_workflow_trace_dir(workflow_run_id).resolve()
        if session_id is not None:
            return get_session_trace_dir(session_id).resolve()
        if session_id is None:
            return self._resolve_log_dir()
        return get_session_trace_dir(session_id).resolve()

    def _list_files(self, log_dir: Path) -> list[str]:
        if not log_dir.exists():
            return []
        return sorted(path.name for path in log_dir.iterdir() if path.is_file())

    def _viewer_url(
        self,
        *,
        session_id: str | None = None,
        workflow_run_id: str | None = None,
    ) -> str | None:
        # live viewer 是 runtime 级，不是 session 过滤视图。
        if session_id is not None or workflow_run_id is not None:
            return None
        tracer = self._tracer()
        live_server = getattr(tracer, "_live_server", None)
        if live_server is None or live_server.port is None:
            return None
        return f"http://127.0.0.1:{live_server.port}/trace_viewer.html"

    def _filter_task_meta(
        self,
        *,
        session_id: str | None = None,
        workflow_run_id: str | None = None,
    ) -> dict[int, dict]:
        tracer = self._tracer()
        if session_id is None and workflow_run_id is None:
            return {task_id: deepcopy(meta) for task_id, meta in tracer.task_meta.items()}
        if workflow_run_id is not None:
            return {
                task_id: deepcopy(meta)
                for task_id, meta in tracer.task_meta.items()
                if meta.get("workflow_run_id") == workflow_run_id
            }
        return {
            task_id: deepcopy(meta)
            for task_id, meta in tracer.task_meta.items()
            if meta.get("session_id") == session_id
        }

    def status(
        self,
        *,
        session_id: str | None = None,
        workflow_run_id: str | None = None,
    ) -> TracingStatus:
        tracer = self._tracer()
        filtered_task_meta = self._filter_task_meta(
            session_id=session_id,
            workflow_run_id=workflow_run_id,
        )
        log_dir = self._resolve_scope_log_dir(
            session_id=session_id,
            workflow_run_id=workflow_run_id,
        )
        config = tracer.config
        scope = "runtime"
        if session_id is not None:
            scope = "session"
        elif workflow_run_id is not None:
            scope = "workflow"

        return TracingStatus(
            scope=scope,  # type: ignore[arg-type]
            session_id=session_id,
            workflow_run_id=workflow_run_id,
            project_root=str(PROJECT_ROOT),
            runtime_initialized=True,
            trace_id=tracer.get_trace_id(),
            collecting=config.is_collecting,
            tracked_task_count=len(filtered_task_meta),
            runtime_tracked_task_count=len(tracer.task_meta),
            log_dir=str(log_dir),
            viewer_url=self._viewer_url(
                session_id=session_id,
                workflow_run_id=workflow_run_id,
            ),
            available_files=self._list_files(log_dir),
            config=TracingConfigSummary(
                collection_level=config.collection_level.value,
                export_enabled=config.export_enabled,
                online_tracing=config.online_tracing,
                cloud_enabled=config.cloud_enabled,
                log_dir=str(log_dir),
                project=config.project,
                build=config.build,
                session_id=config.session_id,
            ),
        )

    def export(
        self,
        *,
        session_id: str | None = None,
        workflow_run_id: str | None = None,
    ) -> TraceExportResult:
        tracer = self._tracer()
        filtered_task_meta = self._filter_task_meta(
            session_id=session_id,
            workflow_run_id=workflow_run_id,
        )
        log_dir = self._resolve_scope_log_dir(
            session_id=session_id,
            workflow_run_id=workflow_run_id,
        )
        log_dir.mkdir(parents=True, exist_ok=True)
        scope = "runtime"
        if session_id is not None:
            scope = "session"
        elif workflow_run_id is not None:
            scope = "workflow"

        if not tracer.config.is_collecting:
            return TraceExportResult(
                scope=scope,  # type: ignore[arg-type]
                session_id=session_id,
                workflow_run_id=workflow_run_id,
                project_root=str(PROJECT_ROOT),
                trace_id=tracer.get_trace_id(),
                exported=False,
                log_dir=str(log_dir),
                files=self._list_files(log_dir),
                message="当前 tracing collection_level=disabled，没有可导出的 trace 数据",
            )

        if not filtered_task_meta:
            return TraceExportResult(
                scope=scope,  # type: ignore[arg-type]
                session_id=session_id,
                workflow_run_id=workflow_run_id,
                project_root=str(PROJECT_ROOT),
                trace_id=tracer.get_trace_id(),
                exported=False,
                log_dir=str(log_dir),
                files=self._list_files(log_dir),
                message="当前作用域还没有采集到任务 span",
            )

        # 不调用 runtime.export_trace()，避免服务端导出时尝试打开浏览器。
        exporter = CompositeExporter(
            [
                JSONStateExporter(indent=4),
                HTMLViewerExporter(quiet=True),
                JaegerExporter(quiet=True),
            ]
        )
        exporter.export(filtered_task_meta, log_dir)

        files = self._list_files(log_dir)
        return TraceExportResult(
            scope=scope,  # type: ignore[arg-type]
            session_id=session_id,
            workflow_run_id=workflow_run_id,
            project_root=str(PROJECT_ROOT),
            trace_id=tracer.get_trace_id(),
            exported=True,
            log_dir=str(log_dir),
            files=files,
            trace_viewer_file=str(log_dir / "trace_viewer.html")
            if "trace_viewer.html" in files
            else None,
            json_state_file=str(log_dir / "tracer_state.json")
            if "tracer_state.json" in files
            else None,
            jaeger_file=str(log_dir / "jaeger_traces.json")
            if "jaeger_traces.json" in files
            else None,
            message=f"已导出 {len(files)} 个 trace 文件",
        )
