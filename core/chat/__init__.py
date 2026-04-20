from __future__ import annotations

from typing import Any


def __getattr__(name: str) -> Any:
    if name == "ChatService":
        from .service import ChatService

        return ChatService
    if name == "ChatSession":
        from .session import ChatSession

        return ChatSession
    if name == "SessionTitleService":
        from .title import SessionTitleService

        return SessionTitleService
    if name == "ToolMessageSummaryService":
        from .tool_summary import ToolMessageSummaryService

        return ToolMessageSummaryService
    if name in {
        "format_sse",
        "get_conversation_log_path",
        "get_session_manifest_path",
        "get_session_storage_dir",
        "get_session_upload_dir",
        "utc_now_iso",
    }:
        from . import utils as chat_utils

        return getattr(chat_utils, name)
    raise AttributeError(name)


__all__ = [
    "ChatService",
    "ChatSession",
    "SessionTitleService",
    "ToolMessageSummaryService",
    "format_sse",
    "get_conversation_log_path",
    "get_session_manifest_path",
    "get_session_storage_dir",
    "get_session_upload_dir",
    "utc_now_iso",
]
