from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import UploadFile

from core.config.paths import CONVERSATION_LOG_DIR, SESSIONS_DIR
from core.schemas.session import (
    MessageResponse,
    SessionCreateRequest,
    SessionDetail,
    SessionManifest,
    SessionMessageDeleteResponse,
    SessionSummary,
    SessionUpdateRequest,
)
from core.tracing import get_session_trace_dir
from core.visualization import (
    DataAnalysisWorkflowService,
    VisualizationPolicyService,
    VisualizationProtocolService,
    VisualizationRewriteService,
)
from .session import ChatSession
from .title import SessionTitleService
from .utils import (
    get_conversation_log_path,
    get_session_storage_dir,
    get_session_upload_dir,
)


class ChatService:
    def __init__(
        self,
        *,
        title_service: SessionTitleService | None = None,
        data_analysis_service: DataAnalysisWorkflowService | None = None,
        visualization_policy_service: VisualizationPolicyService | None = None,
        visualization_protocol_service: VisualizationProtocolService | None = None,
        visualization_rewrite_service: VisualizationRewriteService | None = None,
    ) -> None:
        self._sessions: dict[str, ChatSession] = {}
        self._title_service = title_service or SessionTitleService()
        self._data_analysis_service = data_analysis_service or DataAnalysisWorkflowService()
        self._visualization_policy_service = visualization_policy_service or VisualizationPolicyService()
        self._visualization_protocol_service = visualization_protocol_service or VisualizationProtocolService()
        self._visualization_rewrite_service = visualization_rewrite_service or VisualizationRewriteService(
            protocol_service=self._visualization_protocol_service,
        )

    def list_sessions(self) -> list[SessionSummary]:
        for session in self._sessions.values():
            if not session._has_title() and session.history():
                session.ensure_fallback_title()
                session.persist()
        return sorted(
            (session.summary() for session in self._sessions.values()),
            key=lambda summary: summary.updated_at,
            reverse=True,
        )

    def create_session(self, config: SessionCreateRequest) -> SessionDetail:
        session = ChatSession.create(
            config=config,
            title_service=self._title_service,
            data_analysis_service=self._data_analysis_service,
            visualization_policy_service=self._visualization_policy_service,
            visualization_protocol_service=self._visualization_protocol_service,
            visualization_rewrite_service=self._visualization_rewrite_service,
        )
        self._sessions[session.session_id] = session
        session.persist()
        return session.detail()

    def update_session(self, session_id: str, update: SessionUpdateRequest) -> SessionDetail:
        session = self.get_session(session_id)
        return session.reconfigure(update)

    def restore_sessions(self) -> list[SessionDetail]:
        """从 runtime/sessions 和 conversation_logs 恢复历史会话。"""

        restored: list[SessionDetail] = []
        archived_session_ids: set[str] = set()

        for manifest_path in sorted(SESSIONS_DIR.glob("*/meta.json")):
            manifest = self._load_manifest(manifest_path)
            if manifest is None:
                continue
            if manifest.archived:
                archived_session_ids.add(manifest.session_id)
                continue
            if manifest.session_id in self._sessions:
                continue
            session = self._restore_from_manifest(manifest)
            self._sessions[session.session_id] = session
            restored.append(session.detail())

        for log_path in sorted(CONVERSATION_LOG_DIR.glob("*.jsonl")):
            session_id = log_path.stem
            if session_id in self._sessions or session_id in archived_session_ids:
                continue
            session = self._restore_from_legacy_log(log_path)
            if session is None:
                continue
            self._sessions[session.session_id] = session
            session.persist()
            restored.append(session.detail())

        return sorted(restored, key=lambda detail: detail.updated_at, reverse=True)

    def get_session(self, session_id: str) -> ChatSession:
        session = self._sessions.get(session_id)
        if session is None:
            raise KeyError(session_id)
        if not session._has_title() and session.history():
            session.ensure_fallback_title()
            session.persist()
        return session

    async def backfill_missing_titles(self, *, limit: int = 3) -> int:
        """为历史无标题会话补标题。"""

        updated_count = 0
        candidates = [
            item
            for item in sorted(
                self._sessions.values(),
                key=lambda item: item.updated_at,
                reverse=True,
            )
            if not item._has_title() and item.history()
        ]
        for session in candidates[:limit]:
            title_before = session.config.title
            await session.ensure_title()
            if not session._has_title():
                session.ensure_fallback_title()
            if session.config.title != title_before:
                session.persist()
                updated_count += 1
        return updated_count

    def delete_session(self, session_id: str) -> None:
        session = self._sessions.pop(session_id, None)
        if session is None:
            raise KeyError(session_id)
        self._delete_session_runtime_files(session_id)

    async def send_message(
        self,
        session_id: str,
        content: str,
        uploads: list[UploadFile] | None = None,
    ) -> MessageResponse:
        session = self.get_session(session_id)
        result = await session.ask(content, uploads=uploads)
        return MessageResponse(
            session_id=session_id,
            assistant=result.assistant,
            metrics=result.metrics,
            status="idle",
        )

    def delete_session_messages(self, session_id: str, indices: list[int]) -> SessionMessageDeleteResponse:
        session = self.get_session(session_id)
        deleted_count = session.delete_messages(indices)
        return SessionMessageDeleteResponse(
            session_id=session_id,
            deleted_count=deleted_count,
            message_count=len(session.history()),
            updated_at=session.updated_at,
        )

    def _load_manifest(self, manifest_path: Path) -> SessionManifest | None:
        try:
            return SessionManifest.model_validate_json(manifest_path.read_text(encoding="utf-8"))
        except Exception:
            return None

    def _delete_session_runtime_files(self, session_id: str) -> None:
        """彻底删除某个 session 的运行时痕迹。"""

        storage_dir = get_session_storage_dir(session_id)
        upload_dir = get_session_upload_dir(session_id)
        trace_dir = get_session_trace_dir(session_id)
        candidate_logs = [get_conversation_log_path(session_id), *CONVERSATION_LOG_DIR.glob(f"{session_id}::*")]

        for log_path in candidate_logs:
            if log_path.exists():
                log_path.unlink()

        for directory in (storage_dir, upload_dir, trace_dir):
            if directory.exists():
                shutil.rmtree(directory)

    def _restore_from_manifest(self, manifest: SessionManifest) -> ChatSession:
        return ChatSession.create(
            config=manifest.config,
            session_id=manifest.session_id,
            created_at=manifest.created_at,
            updated_at=manifest.updated_at,
            status=manifest.status,
            last_error=manifest.last_error,
            last_response=manifest.last_response,
            root_usage=manifest.root_usage,
            specialist_ledgers=manifest.specialist_ledgers,
            title_service=self._title_service,
            data_analysis_service=self._data_analysis_service,
            visualization_policy_service=self._visualization_policy_service,
            visualization_protocol_service=self._visualization_protocol_service,
            visualization_rewrite_service=self._visualization_rewrite_service,
        )

    def _restore_from_legacy_log(self, log_path: Path) -> ChatSession | None:
        system_prompt = SessionCreateRequest.model_fields["system_prompt"].default
        created_at = datetime.fromtimestamp(log_path.stat().st_mtime, timezone.utc).isoformat()
        updated_at = created_at

        try:
            with log_path.open(encoding="utf-8") as handle:
                for raw_line in handle:
                    line = raw_line.strip()
                    if not line:
                        continue
                    entry = json.loads(line)
                    ts = entry.get("ts")
                    if ts:
                        if ts < created_at:
                            created_at = ts
                        if ts > updated_at:
                            updated_at = ts
                    if entry.get("type") == "session_meta":
                        system_prompt = entry.get("system_prompt") or system_prompt
                        break
        except Exception:
            return None

        config = SessionCreateRequest(
            title=f"历史会话 {log_path.stem[:8]}",
            system_prompt=system_prompt,
        )
        return ChatSession.create(
            config=config,
            session_id=log_path.stem,
            created_at=created_at,
            updated_at=updated_at,
            title_service=self._title_service,
            data_analysis_service=self._data_analysis_service,
            visualization_policy_service=self._visualization_policy_service,
            visualization_protocol_service=self._visualization_protocol_service,
            visualization_rewrite_service=self._visualization_rewrite_service,
        )
