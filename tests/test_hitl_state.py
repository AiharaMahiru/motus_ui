import shutil
import unittest
import uuid

from motus.models import ChatMessage
from motus.serve.interrupt import InterruptMessage
from motus.serve.schemas import SessionStatus

from core.config.paths import HITL_SESSIONS_DIR
from core.servers.hitl_state import PersistentSessionStore, get_hitl_session_state_path


class HitlSessionStoreTests(unittest.TestCase):
    def test_reconcile_runtime_state_clears_stale_running_without_task(self) -> None:
        session_id = str(uuid.uuid4())
        self.addCleanup(lambda: shutil.rmtree(HITL_SESSIONS_DIR / session_id, ignore_errors=True))

        store = PersistentSessionStore()
        session = store.create(session_id=session_id)
        session.status = SessionStatus.running
        session._task = None

        session.reconcile_runtime_state()

        self.assertEqual(session.status, SessionStatus.idle)

    def test_restore_idle_session_keeps_history(self) -> None:
        session_id = str(uuid.uuid4())
        self.addCleanup(lambda: shutil.rmtree(HITL_SESSIONS_DIR / session_id, ignore_errors=True))

        store = PersistentSessionStore()
        session = store.create(
            session_id=session_id,
            state=[ChatMessage.user_message("你好"), ChatMessage.assistant_message("你好，我在。")],
        )
        session.response = ChatMessage.assistant_message("你好，我在。")
        session.persist()

        restored_store = PersistentSessionStore()
        restored = restored_store.get(session_id)

        self.assertIsNotNone(restored)
        self.assertEqual(restored.status, SessionStatus.idle)
        self.assertEqual(len(restored.state), 2)
        self.assertEqual(restored.state[-1].content, "你好，我在。")

    def test_restore_running_session_marks_error_and_keeps_pending_message(self) -> None:
        session_id = str(uuid.uuid4())
        self.addCleanup(lambda: shutil.rmtree(HITL_SESSIONS_DIR / session_id, ignore_errors=True))

        store = PersistentSessionStore()
        session = store.create(
            session_id=session_id,
            state=[ChatMessage.user_message("上一轮消息")],
        )
        session.pending_message = ChatMessage.user_message("这一轮还没完成")
        session.status = SessionStatus.running
        session.persist()

        restored_store = PersistentSessionStore()
        restored = restored_store.get(session_id)

        self.assertIsNotNone(restored)
        self.assertEqual(restored.status, SessionStatus.error)
        self.assertIn("服务重启", restored.error or "")
        self.assertEqual(restored.state[-1].content, "这一轮还没完成")
        self.assertEqual(restored.pending_message.content, "这一轮还没完成")

    def test_restore_interrupted_session_preserves_interrupt_context(self) -> None:
        session_id = str(uuid.uuid4())
        self.addCleanup(lambda: shutil.rmtree(HITL_SESSIONS_DIR / session_id, ignore_errors=True))

        store = PersistentSessionStore()
        session = store.create(
            session_id=session_id,
            state=[ChatMessage.user_message("请先审批这个动作")],
        )
        session.pending_message = ChatMessage.user_message("请先审批这个动作")
        session.pending_interrupts["approve-1"] = InterruptMessage(
            interrupt_id="approve-1",
            payload={"type": "approval", "question": "是否允许继续执行？"},
        )
        session.status = SessionStatus.interrupted
        session.persist()

        restored_store = PersistentSessionStore()
        restored = restored_store.get(session_id)

        self.assertIsNotNone(restored)
        self.assertEqual(restored.status, SessionStatus.error)
        self.assertIn("等待人工确认", restored.error or "")
        self.assertEqual(restored.pending_message.content, "请先审批这个动作")
        self.assertIn("approve-1", restored.pending_interrupts)
        self.assertEqual(
            restored.pending_interrupts["approve-1"].payload["question"],
            "是否允许继续执行？",
        )

    def test_delete_session_cleans_persisted_state(self) -> None:
        session_id = str(uuid.uuid4())
        store = PersistentSessionStore()
        store.create(session_id=session_id)

        state_path = get_hitl_session_state_path(session_id)
        self.assertTrue(state_path.exists())

        deleted = store.delete(session_id)

        self.assertTrue(deleted)
        self.assertFalse(state_path.exists())


if __name__ == "__main__":
    unittest.main()
