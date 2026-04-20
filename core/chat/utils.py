from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from core.config.paths import CONVERSATION_LOG_DIR, SESSIONS_DIR, UPLOADS_DIR


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def format_sse(event: str, data: dict[str, Any]) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"


def get_session_storage_dir(session_id: str) -> Path:
    return SESSIONS_DIR / session_id


def get_session_manifest_path(session_id: str) -> Path:
    return get_session_storage_dir(session_id) / "meta.json"


def get_conversation_log_path(session_id: str) -> Path:
    return CONVERSATION_LOG_DIR / f"{session_id}.jsonl"


def get_session_upload_dir(session_id: str) -> Path:
    return UPLOADS_DIR / session_id


def sanitize_upload_filename(filename: str | None) -> str:
    raw_name = Path(filename or "upload.bin").name.strip()
    return raw_name or "upload.bin"


def format_bytes(size_bytes: int) -> str:
    size = float(size_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:.1f}{unit}" if unit != "B" else f"{int(size)}B"
        size /= 1024
    return f"{int(size_bytes)}B"
