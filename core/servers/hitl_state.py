from __future__ import annotations

import shutil
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from pydantic import BaseModel, Field

from motus.models import ChatMessage
from motus.serve.interrupt import InterruptMessage
from motus.serve.schemas import SessionStatus
from motus.serve.session import Session, SessionAlreadyExists, SessionLimitReached, SessionStore

from core.config.paths import HITL_SESSIONS_DIR
from core.chat import utc_now_iso


class HitlSessionStateManifest(BaseModel):
    """HITL 会话的持久化快照。"""

    session_id: str
    status: SessionStatus
    state: list[ChatMessage] = Field(default_factory=list)
    response: ChatMessage | None = None
    error: str | None = None
    pending_message: ChatMessage | None = None
    pending_interrupts: list["HitlPendingInterruptManifest"] = Field(default_factory=list)
    created_at: str
    updated_at: str


class HitlPendingInterruptManifest(BaseModel):
    """持久化等待中的 interrupt，便于重启后诊断。"""

    interrupt_id: str
    payload: dict[str, Any] = Field(default_factory=dict)


HitlSessionStateManifest.model_rebuild()


def get_hitl_session_state_path(session_id: str) -> Path:
    """返回 HITL 会话状态清单路径。"""

    return HITL_SESSIONS_DIR / session_id / "state.json"


@dataclass
class PersistentSession(Session):
    """带磁盘持久化能力的 HITL Session。"""

    created_at: str = field(default_factory=utc_now_iso)
    updated_at: str = field(default_factory=utc_now_iso)
    pending_message: ChatMessage | None = None
    _persist_callback: Callable[["PersistentSession"], None] | None = field(default=None, repr=False)

    def persist(self) -> None:
        if self._persist_callback is not None:
            self._persist_callback(self)

    def reconcile_runtime_state(self) -> None:
        """修正残留的运行态，避免会话永久卡在 running。"""

        next_status: SessionStatus | None = None

        if self.status == SessionStatus.running and (self._task is None or self._task.done()):
            next_status = SessionStatus.error if self.error else SessionStatus.idle
        elif self.status == SessionStatus.interrupted and not self.pending_interrupts:
            next_status = SessionStatus.error if self.error else SessionStatus.idle

        if next_status is None:
            return

        self.status = next_status
        self.updated_at = utc_now_iso()
        self.persist()

    def mark_pending_message(self, message: ChatMessage) -> None:
        self.pending_message = message
        self.updated_at = utc_now_iso()
        self.persist()

    def start_turn(self, task) -> None:  # type: ignore[override]
        super().start_turn(task)
        self.updated_at = utc_now_iso()
        self.persist()

    def complete_turn(self, response: ChatMessage, new_state: list[ChatMessage]) -> None:  # type: ignore[override]
        super().complete_turn(response, new_state)
        self.pending_message = None
        self.updated_at = utc_now_iso()
        self.persist()

    def fail_turn(self, error: str) -> None:  # type: ignore[override]
        super().fail_turn(error)
        self.updated_at = utc_now_iso()
        self.persist()

    def cancel(self) -> None:  # type: ignore[override]
        super().cancel()
        self.updated_at = utc_now_iso()
        self.persist()

    def interrupt_turn(self, msg: InterruptMessage) -> None:  # type: ignore[override]
        super().interrupt_turn(msg)
        self.updated_at = utc_now_iso()
        self.persist()

    def submit_resume(self, interrupt_id: str, value) -> None:  # type: ignore[override]
        super().submit_resume(interrupt_id, value)
        self.updated_at = utc_now_iso()
        self.persist()


class PersistentSessionStore(SessionStore):
    """为 Motus HITL SessionStore 增加本地持久化。"""

    def __init__(self, *, ttl: float = 0, max_sessions: int = 0):
        super().__init__(ttl=ttl, max_sessions=max_sessions)
        HITL_SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
        self.restore()

    def create(
        self,
        state: list[ChatMessage] | None = None,
        session_id: str | None = None,
    ) -> PersistentSession:
        if session_id is not None and session_id in self._sessions:
            raise SessionAlreadyExists(f"Session {session_id} already exists")
        if self.max_sessions > 0 and len(self._sessions) >= self.max_sessions:
            raise SessionLimitReached(
                f"Maximum number of sessions ({self.max_sessions}) reached"
            )
        if session_id is None:
            import uuid

            session_id = str(uuid.uuid4())
        session = PersistentSession(
            session_id=session_id,
            state=state or [],
            _persist_callback=self._persist_session,
        )
        self._sessions[session_id] = session
        self._persist_session(session)
        return session

    def delete(self, session_id: str) -> bool:
        deleted = super().delete(session_id)
        if not deleted:
            return False
        storage_dir = HITL_SESSIONS_DIR / session_id
        if storage_dir.exists():
            shutil.rmtree(storage_dir, ignore_errors=True)
        return True

    def sweep(self) -> int:
        if self.ttl <= 0:
            return 0
        now = time.monotonic()
        expired = [
            sid
            for sid, session in self._sessions.items()
            if session.status not in (SessionStatus.running, SessionStatus.interrupted)
            and now - session.last_message_at > self.ttl
        ]
        for sid in expired:
            self._sessions[sid].cancel()
            del self._sessions[sid]
            storage_dir = HITL_SESSIONS_DIR / sid
            if storage_dir.exists():
                shutil.rmtree(storage_dir, ignore_errors=True)
        return len(expired)

    def restore(self) -> list[PersistentSession]:
        restored: list[PersistentSession] = []
        for manifest_path in sorted(HITL_SESSIONS_DIR.glob("*/state.json")):
            manifest = self._load_manifest(manifest_path)
            if manifest is None:
                continue
            if manifest.session_id in self._sessions:
                continue
            session = self._restore_session(manifest)
            self._sessions[session.session_id] = session
            restored.append(session)
        return restored

    def _persist_session(self, session: PersistentSession) -> None:
        manifest_path = get_hitl_session_state_path(session.session_id)
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest = HitlSessionStateManifest(
            session_id=session.session_id,
            status=session.status,
            state=list(session.state),
            response=session.response,
            error=session.error,
            pending_message=session.pending_message,
            pending_interrupts=[
                HitlPendingInterruptManifest(
                    interrupt_id=interrupt_id,
                    payload=dict(message.payload or {}),
                )
                for interrupt_id, message in session.pending_interrupts.items()
            ],
            created_at=session.created_at,
            updated_at=session.updated_at,
        )
        manifest_path.write_text(
            manifest.model_dump_json(indent=2, exclude_none=True),
            encoding="utf-8",
        )

    def _load_manifest(self, manifest_path: Path) -> HitlSessionStateManifest | None:
        try:
            return HitlSessionStateManifest.model_validate_json(manifest_path.read_text(encoding="utf-8"))
        except Exception:
            return None

    def _restore_session(self, manifest: HitlSessionStateManifest) -> PersistentSession:
        status = manifest.status
        error = manifest.error
        state = list(manifest.state)
        pending_message = manifest.pending_message
        updated_at = manifest.updated_at
        pending_interrupts = {
            item.interrupt_id: InterruptMessage(
                interrupt_id=item.interrupt_id,
                payload=dict(item.payload),
            )
            for item in manifest.pending_interrupts
        }

        if status in {SessionStatus.running, SessionStatus.interrupted}:
            if pending_message is not None:
                last_message = state[-1] if state else None
                if last_message != pending_message:
                    state = [*state, pending_message]
            status = SessionStatus.error
            if manifest.status == SessionStatus.interrupted:
                error = error or "HITL 会话在等待人工确认时遇到服务重启，无法继续原地恢复，请重新发起该轮请求。"
            else:
                error = error or "HITL 会话在服务重启时被中断，无法继续原地恢复，请重新发起该轮请求。"
            updated_at = utc_now_iso()

        session = PersistentSession(
            session_id=manifest.session_id,
            status=status,
            state=state,
            response=manifest.response,
            error=error,
            last_message_at=time.monotonic(),
            created_at=manifest.created_at,
            updated_at=updated_at,
            pending_message=pending_message if status == SessionStatus.error else None,
            _persist_callback=self._persist_session,
        )
        session._done.set()
        if status == SessionStatus.error and pending_interrupts:
            session.pending_interrupts.update(pending_interrupts)
        else:
            session.pending_interrupts.clear()
        self._persist_session(session)
        return session
