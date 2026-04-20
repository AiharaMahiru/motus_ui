from __future__ import annotations

import mimetypes
import re
from pathlib import Path

from core.config.paths import OUTPUT_DIR
from core.schemas.preview import PreviewLanguage

PREVIEW_ROOT = OUTPUT_DIR / "previews"
DEFAULT_PREVIEW_TIMEOUT_SECONDS = 600.0
PREFERRED_PYTHON_ARTIFACTS = (
    "preview.html",
    "index.html",
    "preview.svg",
    "preview.png",
    "output.html",
    "output.svg",
    "output.png",
)
TERMINAL_PYTHON_MARKERS = (
    r"\bwhile\s+true\s*:",
    r"\\x1b\[",
    r"os\.system\((?:'|\")clear(?:'|\")\)",
    r"os\.system\((?:'|\")cls(?:'|\")\)",
    r"sys\.stdout\.write",
    r"sys\.stdout\.flush",
    r"hide_cursor",
    r"show_cursor",
    r"\binput\s*\(",
    r"\bgetpass\b",
    r"\bsys\.stdin\b",
    r"\bcurses\b",
    r"\brich\.live\b",
    r"\btextual\b",
)
PYTHON_PREVIEW_OUTPUT_MARKERS = (
    "agent_preview_dir",
    "preview.html",
    "preview.svg",
    "preview.png",
    "output.html",
    "output.svg",
    "output.png",
    "<!doctype html",
    "<html",
    "<svg",
    ".savefig(",
    ".imsave(",
)


def get_session_preview_root(session_id: str) -> Path:
    return PREVIEW_ROOT / session_id


def get_preview_run_dir(session_id: str, run_id: str) -> Path:
    return get_session_preview_root(session_id) / run_id


def get_preview_run_manifest_path(session_id: str, run_id: str) -> Path:
    return get_preview_run_dir(session_id, run_id) / "run.json"


def get_preview_request_manifest_path(session_id: str, run_id: str) -> Path:
    return get_preview_run_dir(session_id, run_id) / "request.json"


def build_preview_file_url(session_id: str, run_id: str, relative_path: str) -> str:
    return f"/api/sessions/{session_id}/preview-runs/{run_id}/artifacts/{relative_path}"


def normalize_preview_language(language: PreviewLanguage) -> str:
    normalized = str(language).strip().lower()
    if normalized in {"html", "htm"}:
        return "html"
    if normalized in {"tsx", "jsx", "react"}:
        return "react"
    return "python"


def ensure_safe_relative_path(path: Path, root: Path) -> str:
    resolved = path.resolve()
    return str(resolved.relative_to(root.resolve())).replace("\\", "/")


def guess_content_type(path: Path) -> str:
    guessed, _ = mimetypes.guess_type(path.name)
    if guessed:
        return guessed
    if path.suffix.lower() == ".svg":
        return "image/svg+xml"
    return "application/octet-stream"


def detect_html_like_output(stdout: str | None) -> tuple[str, str] | None:
    if not stdout:
        return None
    normalized = stdout.strip()
    lowered = normalized.lower()
    if lowered.startswith("<!doctype html") or lowered.startswith("<html"):
        return "stdout-preview.html", normalized
    if lowered.startswith("<svg"):
        return "stdout-preview.svg", normalized
    return None


def find_python_artifact(run_dir: Path) -> Path | None:
    for file_name in PREFERRED_PYTHON_ARTIFACTS:
        candidate = run_dir / file_name
        if candidate.exists() and candidate.is_file():
            return candidate

    for marker in PYTHON_PREVIEW_OUTPUT_MARKERS:
        for candidate in run_dir.rglob("*"):
            if not candidate.is_file():
                continue
            candidate_name = candidate.name.lower()
            if marker.startswith("."):
                if candidate_name.endswith(marker):
                    return candidate
            elif marker in candidate_name:
                return candidate
    return None


def looks_like_terminal_python_script(code: str) -> bool:
    for marker in TERMINAL_PYTHON_MARKERS:
        if re.search(marker, code):
            return True
    return False
