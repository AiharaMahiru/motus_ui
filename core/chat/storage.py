from __future__ import annotations

import base64
import json
import time
import uuid
from copy import deepcopy
from typing import Any

from fastapi import UploadFile
from motus.models import ChatMessage

from core.schemas.session import PersistedAgentUsageLedger, SessionManifest
from .utils import (
    format_bytes,
    get_conversation_log_path,
    get_session_manifest_path,
    get_session_upload_dir,
    sanitize_upload_filename,
    utc_now_iso,
)


class ChatSessionStorageMixin:
    def manifest(self, *, archived: bool = False) -> SessionManifest:
        return SessionManifest(
            session_id=self.session_id,
            created_at=self.created_at,
            updated_at=self.updated_at,
            archived=archived,
            status=self.status,
            config=self.config,
            last_error=self.last_error,
            last_response=self.last_response,
            root_usage=deepcopy(self.agent.usage),
            specialist_ledgers=[
                PersistedAgentUsageLedger.model_validate(item)
                for item in self.specialist_usage_tracker.export_state()
            ],
        )

    def persist(self, *, archived: bool = False) -> None:
        """把会话元数据写入 runtime/sessions/<session_id>/meta.json。"""

        manifest_path = get_session_manifest_path(self.session_id)
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(
            self.manifest(archived=archived).model_dump_json(indent=2, exclude_none=True),
            encoding="utf-8",
        )

    def _memory_messages(self) -> list[ChatMessage]:
        return list(getattr(self.agent.memory, "_messages", []))

    def _recompute_pending_tool_calls(self, messages: list[ChatMessage]) -> None:
        pending_tool_calls = 0
        for message in messages:
            if message.role == "assistant":
                pending_tool_calls = len(message.tool_calls or [])
            elif message.role == "tool":
                pending_tool_calls = max(0, pending_tool_calls - 1)
        if hasattr(self.agent.memory, "_pending_tool_calls"):
            self.agent.memory._pending_tool_calls = pending_tool_calls

    def _rewrite_conversation_log(self, messages: list[ChatMessage]) -> None:
        """重写 JSONL 会话日志，保证删除消息后重启仍一致。"""

        log_path = get_conversation_log_path(self.session_id)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        memory_config = getattr(self.agent.memory, "config", None)
        log_entries = [
            {
                "type": "session_meta",
                "ts": self.created_at,
                "session_id": self.session_id,
                "system_prompt": getattr(self.agent.memory, "_system_prompt", "") or self.config.system_prompt,
                "config": {
                    "safety_ratio": getattr(memory_config, "safety_ratio", None),
                    "token_threshold": getattr(memory_config, "token_threshold", None),
                    "compact_model_name": getattr(memory_config, "compact_model_name", None),
                    "max_tool_result_tokens": getattr(memory_config, "max_tool_result_tokens", None),
                },
                "parent_session_id": getattr(self.agent.memory, "_parent_session_id", None),
            }
        ]
        for message in messages:
            timestamp = (
                getattr(message, "timestamp", None)
                or getattr(message, "created_at", None)
                or getattr(message, "updated_at", None)
                or utc_now_iso()
            )
            log_entries.append(
                {
                    "type": "message",
                    "ts": timestamp,
                    "message": message.model_dump(exclude_none=True),
                }
            )
        log_path.write_text(
            "".join(f"{json.dumps(entry, ensure_ascii=False)}\n" for entry in log_entries),
            encoding="utf-8",
        )

    async def _save_attachments(self, uploads: list[UploadFile]) -> list[dict[str, Any]]:
        """保存上传附件，并为当前轮构造统一元信息。"""

        if not uploads:
            return []

        attachment_dir = get_session_upload_dir(self.session_id)
        attachment_dir.mkdir(parents=True, exist_ok=True)
        descriptors: list[dict[str, Any]] = []
        timestamp_prefix = int(time.time())

        for index, upload in enumerate(uploads, start=1):
            raw_bytes = await upload.read()
            await upload.close()
            if not raw_bytes:
                continue

            safe_name = sanitize_upload_filename(upload.filename)
            stored_name = f"{timestamp_prefix}-{index:02d}-{uuid.uuid4().hex[:8]}-{safe_name}"
            file_path = attachment_dir / stored_name
            file_path.write_bytes(raw_bytes)

            mime_type = upload.content_type or "application/octet-stream"
            is_image = mime_type.startswith("image/")
            descriptor = {
                "id": uuid.uuid4().hex[:10],
                "kind": "image" if is_image else "file",
                "file_name": safe_name,
                "mime_type": mime_type,
                "size_bytes": len(raw_bytes),
                "size_label": format_bytes(len(raw_bytes)),
                "file_path": str(file_path),
            }
            if is_image:
                descriptor["base64_data"] = base64.b64encode(raw_bytes).decode("ascii")
            descriptors.append(descriptor)

        return descriptors

    def history(self) -> list[ChatMessage]:
        return [message for message in self.agent.memory.messages if message.role != "system"]

    def delete_messages(self, indices: list[int]) -> int:
        """删除指定历史消息，并同步重写 memory 与 JSONL 日志。"""

        self._reconcile_runtime_state()
        if self._lock.locked():
            raise RuntimeError("当前会话正在处理中，暂时不能删除消息")

        normalized_indices = sorted(set(indices))
        if not normalized_indices:
            return 0

        memory_messages = self._memory_messages()
        visible_positions = [
            internal_index
            for internal_index, message in enumerate(memory_messages)
            if message.role != "system"
        ]
        max_index = len(visible_positions) - 1
        if any(index < 0 or index > max_index for index in normalized_indices):
            raise IndexError("消息索引超出范围")

        delete_positions = {visible_positions[index] for index in normalized_indices}
        remaining_messages = [
            message
            for internal_index, message in enumerate(memory_messages)
            if internal_index not in delete_positions
        ]
        self.agent.memory._messages = remaining_messages
        self._recompute_pending_tool_calls(remaining_messages)
        history = self.history()
        self.last_response = next(
            (message for message in reversed(history) if message.role == "assistant"),
            None,
        )
        self.updated_at = utc_now_iso()
        self._rewrite_conversation_log(history)
        self.persist()
        return len(delete_positions)
