import unittest

from core.schemas.session import SessionCreateRequest, SessionUpdateRequest
from core.chat import ChatService


class SessionUpdateTests(unittest.TestCase):
    def test_update_session_reconfigures_current_session(self) -> None:
        service = ChatService()
        detail = service.create_session(
            SessionCreateRequest(
                title='初始会话',
                enabled_tools=['read_file', 'write_file'],
            )
        )

        updated = service.update_session(
            detail.session_id,
            SessionUpdateRequest(
                title='已更新会话',
                model_name='gpt-4o',
                max_steps=2048,
                enabled_tools=['read_file', 'write_file', 'grep_search'],
            ),
        )

        self.assertEqual(updated.session_id, detail.session_id)
        self.assertEqual(updated.title, '已更新会话')
        self.assertEqual(updated.model_name, 'gpt-4o')
        self.assertEqual(updated.max_steps, 2048)
        self.assertIn('grep_search', updated.enabled_tools)
        self.assertEqual(service.get_session(detail.session_id).detail().title, '已更新会话')


if __name__ == '__main__':
    unittest.main()
