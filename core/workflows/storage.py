from __future__ import annotations

from pathlib import Path

from core.config.paths import WORKFLOW_RUNS_DIR
from core.schemas.workflow import WorkflowRunDetail


def get_workflow_run_storage_dir(run_id: str) -> Path:
    """返回单个 workflow run 的持久化目录。"""

    return WORKFLOW_RUNS_DIR / run_id


def get_workflow_run_manifest_path(run_id: str) -> Path:
    """返回 workflow run manifest 路径。"""

    return get_workflow_run_storage_dir(run_id) / "run.json"


def persist_workflow_run(detail: WorkflowRunDetail) -> None:
    """把 workflow run 详情落盘，供服务重启后恢复。"""

    manifest_path = get_workflow_run_manifest_path(detail.run_id)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(
        detail.model_dump_json(indent=2, exclude_none=True),
        encoding="utf-8",
    )


def load_workflow_run(manifest_path: Path) -> WorkflowRunDetail | None:
    """从单个 manifest 恢复 workflow run。"""

    try:
        return WorkflowRunDetail.model_validate_json(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        return None


def iter_persisted_workflow_runs() -> list[WorkflowRunDetail]:
    """读取全部 workflow run manifest。"""

    items: list[WorkflowRunDetail] = []
    for manifest_path in sorted(WORKFLOW_RUNS_DIR.glob("*/run.json")):
        detail = load_workflow_run(manifest_path)
        if detail is not None:
            items.append(detail)
    return items
