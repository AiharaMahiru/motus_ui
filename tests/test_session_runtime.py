import unittest
from pathlib import Path

from motus.models import ChatMessage

from core.schemas.session import SessionCreateRequest
from core.chat import (
    ChatService,
    ChatSession,
    get_conversation_log_path,
    get_session_manifest_path,
    get_session_storage_dir,
    get_session_upload_dir,
)
from core.tracing import get_session_trace_dir


class FakeTitleService:
    async def generate(self, *, messages: list[ChatMessage], session_id: str) -> str:
        return "科学新闻整理"


class SessionRuntimeTests(unittest.TestCase):
    def test_summary_clears_stale_running_status_without_active_turn(self) -> None:
        session = ChatSession.create(config=SessionCreateRequest())
        session.status = "running"

        summary = session.summary()

        self.assertEqual(summary.status, "error")
        self.assertIn("丢失执行上下文", summary.last_error or "")

    def test_restore_root_usage_seeds_agent_usage(self) -> None:
        session = ChatSession.create(
            config=SessionCreateRequest(model_name="gpt-4o"),
            root_usage={
                "prompt_tokens": 120,
                "completion_tokens": 30,
                "total_tokens": 150,
            },
        )

        self.assertEqual(session.agent.usage["total_tokens"], 150)
        self.assertEqual(session.agent.usage["prompt_tokens"], 120)


class SessionTitleTests(unittest.IsolatedAsyncioTestCase):
    async def test_ensure_title_writes_generated_title_back_to_session(self) -> None:
        session = ChatSession.create(
            config=SessionCreateRequest(),
            title_service=FakeTitleService(),
        )
        session.agent.memory.messages.append(ChatMessage.user_message("请整理这几天的科学新闻并输出摘要"))

        title = await session.ensure_title()

        self.assertEqual(title, "科学新闻整理")
        self.assertEqual(session.config.title, "科学新闻整理")

    async def test_chat_service_backfills_missing_titles(self) -> None:
        service = ChatService(title_service=FakeTitleService())
        detail = service.create_session(SessionCreateRequest())
        session = service._sessions[detail.session_id]
        session.config.title = None
        session.history = lambda: [  # type: ignore[method-assign]
            ChatMessage.user_message("请整理这几天的科学新闻并输出摘要"),
            ChatMessage.assistant_message("好的，我来整理。"),
        ]

        updated = await service.backfill_missing_titles(limit=3)

        self.assertEqual(updated, 1)
        self.assertEqual(service.get_session(detail.session_id).config.title, "科学新闻整理")


class SessionMessageDeleteTests(unittest.TestCase):
    def test_delete_session_messages_rewrites_history_and_log(self) -> None:
        service = ChatService(title_service=FakeTitleService())
        detail = service.create_session(SessionCreateRequest(title="删除测试"))
        session = service._sessions[detail.session_id]
        session.agent.memory._messages = [
          ChatMessage.user_message("第一条"),
          ChatMessage.assistant_message("第二条"),
          ChatMessage.user_message("第三条"),
        ]
        session.last_response = ChatMessage.assistant_message("第二条")
        session.persist()

        result = service.delete_session_messages(detail.session_id, [1])
        history = session.history()

        self.assertEqual(result.deleted_count, 1)
        self.assertEqual([message.content for message in history], ["第一条", "第三条"])
        self.assertIsNone(session.last_response)

        log_path = get_conversation_log_path(detail.session_id)
        log_text = log_path.read_text(encoding="utf-8")
        self.assertNotIn("第二条", log_text)
        self.assertIn("第一条", log_text)
        self.assertIn("第三条", log_text)


class SessionDeleteTests(unittest.TestCase):
    def test_delete_session_removes_runtime_files_and_wont_restore(self) -> None:
        service = ChatService(title_service=FakeTitleService())
        detail = service.create_session(SessionCreateRequest(title="删除会话测试"))
        session_id = detail.session_id
        session = service._sessions[session_id]
        session.agent.memory._messages = [
            ChatMessage.user_message("你好"),
            ChatMessage.assistant_message("你好，我在。"),
        ]
        session.persist()
        get_conversation_log_path(session_id).write_text(
            '{"type":"session_meta","session_id":"%s"}\n' % session_id,
            encoding="utf-8",
        )

        # 人工补齐附件与 trace 目录，验证删除会清理整套运行时产物。
        get_session_upload_dir(session_id).mkdir(parents=True, exist_ok=True)
        (get_session_upload_dir(session_id) / "note.txt").write_text("hello", encoding="utf-8")
        get_session_trace_dir(session_id).mkdir(parents=True, exist_ok=True)
        (get_session_trace_dir(session_id) / "trace.jsonl").write_text("{}", encoding="utf-8")

        service.delete_session(session_id)

        self.assertNotIn(session_id, service._sessions)
        self.assertFalse(get_session_storage_dir(session_id).exists())
        self.assertFalse(get_session_manifest_path(session_id).exists())
        self.assertFalse(get_conversation_log_path(session_id).exists())
        self.assertFalse(get_session_upload_dir(session_id).exists())
        self.assertFalse(get_session_trace_dir(session_id).exists())

        restored_service = ChatService(title_service=FakeTitleService())
        restored_service.restore_sessions()
        self.assertNotIn(session_id, restored_service._sessions)


if __name__ == "__main__":
    unittest.main()
