from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TracingConfigSummary(BaseModel):
    """当前 runtime 的 tracing 配置快照。"""

    collection_level: Literal["disabled", "basic", "detailed"]
    export_enabled: bool
    online_tracing: bool
    cloud_enabled: bool
    log_dir: str
    project: str | None = None
    build: str | None = None
    session_id: str | None = None


class TracingStatus(BaseModel):
    """面向 UI 或 API 的 tracing 运行状态。"""

    scope: Literal["runtime", "session", "workflow"] = "runtime"
    session_id: str | None = None
    workflow_run_id: str | None = None
    project_root: str | None = None
    runtime_initialized: bool
    trace_id: str
    collecting: bool
    tracked_task_count: int
    runtime_tracked_task_count: int
    log_dir: str
    viewer_url: str | None = None
    available_files: list[str] = Field(default_factory=list)
    config: TracingConfigSummary


class TraceExportResult(BaseModel):
    """一次离线 trace 导出的结果。"""

    scope: Literal["runtime", "session", "workflow"] = "runtime"
    session_id: str | None = None
    workflow_run_id: str | None = None
    project_root: str | None = None
    trace_id: str
    exported: bool
    log_dir: str
    files: list[str] = Field(default_factory=list)
    trace_viewer_file: str | None = None
    json_state_file: str | None = None
    jaeger_file: str | None = None
    message: str | None = None
