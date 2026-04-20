from __future__ import annotations

from pathlib import Path

from core.config.paths import HITL_SESSIONS_DIR
from core.schemas.session import SessionCreateRequest, SessionUpdateRequest


def get_hitl_session_storage_dir(session_id: str) -> Path:
    """返回 HITL 会话的侧车存储目录。"""

    return HITL_SESSIONS_DIR / session_id


def get_hitl_session_config_path(session_id: str) -> Path:
    """返回 HITL 会话配置文件路径。"""

    return get_hitl_session_storage_dir(session_id) / "config.json"


def load_hitl_session_config(session_id: str) -> SessionCreateRequest | None:
    """读取 HITL 会话配置。"""

    config_path = get_hitl_session_config_path(session_id)
    if not config_path.exists():
        return None
    try:
        return SessionCreateRequest.model_validate_json(config_path.read_text(encoding="utf-8"))
    except Exception:
        return None


def save_hitl_session_config(session_id: str, config: SessionCreateRequest) -> SessionCreateRequest:
    """写入 HITL 会话配置。"""

    config_path = get_hitl_session_config_path(session_id)
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(
        config.model_dump_json(indent=2, exclude_none=True),
        encoding="utf-8",
    )
    return config


def update_hitl_session_config(session_id: str, update: SessionUpdateRequest) -> SessionCreateRequest:
    """按 patch 方式更新 HITL 会话配置。"""

    current = load_hitl_session_config(session_id) or SessionCreateRequest()
    merged = SessionCreateRequest.model_validate(
        {
            **current.model_dump(exclude_none=False),
            **update.model_dump(exclude_unset=True),
        }
    )
    save_hitl_session_config(session_id, merged)
    return merged


def delete_hitl_session_config(session_id: str) -> None:
    """删除 HITL 会话配置。"""

    config_path = get_hitl_session_config_path(session_id)
    if config_path.exists():
        config_path.unlink()

    storage_dir = get_hitl_session_storage_dir(session_id)
    if storage_dir.exists():
        try:
            storage_dir.rmdir()
        except OSError:
            pass
