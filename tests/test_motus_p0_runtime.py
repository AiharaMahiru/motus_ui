import unittest

from motus.models import ChatMessage
from motus.guardrails import InputGuardrailTripped, ToolInputGuardrailTripped

from core.agents.factory import create_mcp_sessions
from core.backends.local import LocalSessionBackend
from core.schemas.session import ChatTurnResult
from core.config.paths import PROJECT_ROOT
from core.guardrails.factory import build_agent_guardrails, make_tool_path_guardrail
from core.schemas.guardrails import GuardrailRule
from core.schemas.mcp import McpServerConfig
from core.schemas.session import SessionCreateRequest
from core.chat import ChatService


class AgentGuardrailFactoryTests(unittest.TestCase):
    def test_deny_regex_input_guardrail_blocks_matching_content(self) -> None:
        guardrails = build_agent_guardrails(
            [
                GuardrailRule(
                    kind="deny_regex",
                    pattern="secret",
                    ignore_case=True,
                    message="输入包含敏感词",
                )
            ],
            direction="input",
        )

        with self.assertRaises(InputGuardrailTripped):
            guardrails[0]("这里有 SECRET")


class ToolPathGuardrailTests(unittest.TestCase):
    def test_workspace_guardrail_rejects_outside_project_root(self) -> None:
        guardrail = make_tool_path_guardrail(
            allowed_roots=[str(PROJECT_ROOT)],
            path_fields=["path"],
            require_absolute_paths=True,
        )

        guardrail(path=str(PROJECT_ROOT / "README.md"))

        with self.assertRaises(ToolInputGuardrailTripped):
            guardrail(path="/etc/passwd")


class McpGovernanceTests(unittest.TestCase):
    def test_mcp_session_keeps_prefix_and_allowlist_options(self) -> None:
        sessions = create_mcp_sessions(
            [
                McpServerConfig(
                    name="demo",
                    transport="local_stdio",
                    command="demo-mcp",
                    args=["serve"],
                    prefix="demo_",
                    allowlist=["search"],
                    method_aliases={"search": "web_search"},
                )
            ]
        )

        self.assertEqual(len(sessions), 1)
        options = getattr(sessions[0], "__tool_options__", {})
        self.assertEqual(options.get("prefix"), "demo_")
        self.assertEqual(options.get("allowlist"), {"search"})
        self.assertEqual(options.get("method_aliases"), {"search": "web_search"})


class LocalBackendCompatibilityTests(unittest.TestCase):
    def test_local_chat_service_rejects_hitl_session_config(self) -> None:
        service = ChatService()

        with self.assertRaises(RuntimeError):
            service.create_session(
                SessionCreateRequest(
                    human_in_the_loop=True,
                )
            )


class LocalMessageCompatibilityTests(unittest.IsolatedAsyncioTestCase):
    async def test_local_backend_run_turn_message_supports_structured_payload(self) -> None:
        class _FakeSession:
            def __init__(self) -> None:
                self.payload = None

            async def ask_message(self, payload, event_queue=None, uploads=None):
                del event_queue, uploads
                self.payload = payload
                return ChatTurnResult(
                    assistant=ChatMessage.assistant_message("处理完成"),
                    metrics=None,  # type: ignore[arg-type]
                )

        class _FakeService:
            def __init__(self, session) -> None:
                self.session = session

            def restore_sessions(self) -> None:
                return None

            def get_session(self, session_id: str):
                self.last_session_id = session_id
                return self.session

        fake_session = _FakeSession()
        backend = LocalSessionBackend(service=_FakeService(fake_session))
        response = await backend.run_turn_message(
            "session-1",
            {
                "content": {"task": "整理科学新闻", "days": 3},
                "user_params": {"display_content": "请整理最近三天科学新闻"},
            },
        )

        self.assertEqual(response.status, "idle")
        self.assertEqual(fake_session.payload["content"]["task"], "整理科学新闻")
        self.assertEqual(fake_session.payload["user_params"]["display_content"], "请整理最近三天科学新闻")

    async def test_local_session_explicitly_rejects_webhook(self) -> None:
        service = ChatService()
        detail = service.create_session(SessionCreateRequest())
        session = service.get_session(detail.session_id)

        with self.assertRaises(RuntimeError):
            await session.ask_message(
                {
                    "content": "测试 webhook",
                    "webhook": {"url": "https://example.com/hook"},
                }
            )


if __name__ == "__main__":
    unittest.main()
