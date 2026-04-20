import unittest
from unittest.mock import patch

from motus.models.openrouter_client import OpenRouterChatClient

from core.agents.factory import build_output_extractor, create_react_agent
from core.agents.multi_agent import MultiAgentUsageTracker, TrackedAgentTool
from core.llm.client_factory import create_chat_client
from core.llm.openai_client import ConfigurableOpenAIChatClient
from core.llm.response_formats import build_response_format_model
from core.schemas.model_client import ModelClientConfig
from core.schemas.multi_agent import OutputExtractorConfig
from core.schemas.response_format import ResponseFieldConfig, ResponseFormatConfig, ResponseSchemaNode


class ClientFactoryTests(unittest.TestCase):
    def test_openai_provider_uses_configurable_openai_client(self) -> None:
        client = create_chat_client(
            provider="openai",
            default_verbosity="medium",
            default_reasoning_effort="medium",
        )

        self.assertIsInstance(client, ConfigurableOpenAIChatClient)

    def test_openrouter_provider_uses_openrouter_client(self) -> None:
        client = create_chat_client(
            provider="openrouter",
            default_verbosity="medium",
            default_reasoning_effort="medium",
        )

        self.assertIsInstance(client, OpenRouterChatClient)

    def test_openai_provider_supports_session_level_model_client_override(self) -> None:
        with patch.dict("os.environ", {"SESSION_OPENAI_KEY": "sk-session-123"}, clear=False):
            client = create_chat_client(
                provider="openai",
                default_verbosity="medium",
                default_reasoning_effort="medium",
                model_client=ModelClientConfig(
                    mode="override",
                    base_url="https://example.test/v1",
                    api_key_env_var="SESSION_OPENAI_KEY",
                ),
            )

        self.assertIsInstance(client, ConfigurableOpenAIChatClient)
        self.assertEqual(str(client._client.base_url).rstrip("/"), "https://example.test/v1")
        self.assertEqual(client._client.api_key, "sk-session-123")


class ResponseFormatBuilderTests(unittest.TestCase):
    def test_build_response_format_model_from_declared_fields(self) -> None:
        model = build_response_format_model(
            ResponseFormatConfig(
                name="NewsSummary",
                fields=[
                    ResponseFieldConfig(name="title", type="string", required=True),
                    ResponseFieldConfig(name="score", type="number", required=False),
                    ResponseFieldConfig(name="tags", type="string[]", required=True),
                ],
            )
        )

        self.assertIsNotNone(model)
        self.assertEqual(model.__name__, "NewsSummary")
        self.assertIn("title", model.model_fields)
        self.assertIn("score", model.model_fields)
        self.assertIn("tags", model.model_fields)
        self.assertFalse(model.model_fields["score"].is_required())

    def test_build_nested_response_format_model(self) -> None:
        model = build_response_format_model(
            ResponseFormatConfig(
                name="ResearchDigest",
                fields=[
                    ResponseFieldConfig(
                        name="summary",
                        type="string",
                    ),
                    ResponseFieldConfig(
                        name="articles",
                        schema_config=ResponseSchemaNode(
                            type="array",
                            items=ResponseSchemaNode(
                                type="object",
                                properties=[
                                    ResponseFieldConfig(name="title", type="string"),
                                    ResponseFieldConfig(name="score", type="number", required=False),
                                ],
                            ),
                        ),
                    ),
                ],
            )
        )

        instance = model.model_validate(
            {
                "summary": "最近三天科研进展",
                "articles": [
                    {"title": "量子芯片突破", "score": 0.91},
                    {"title": "可控核聚变进展"},
                ],
            }
        )

        self.assertEqual(instance.summary, "最近三天科研进展")
        self.assertEqual(instance.articles[0].title, "量子芯片突破")
        self.assertEqual(instance.articles[1].score, None)


class AgentFactoryP1Tests(unittest.TestCase):
    def test_agent_factory_applies_cache_policy_and_response_format(self) -> None:
        response_format = ResponseFormatConfig(
            name="StructuredAnswer",
            fields=[
                ResponseFieldConfig(name="summary", type="string", required=True),
                ResponseFieldConfig(name="confidence", type="number", required=False),
            ],
        )

        agent = create_react_agent(
            system_prompt="你是测试助手",
            agent_name="tester",
            provider="openai",
            model_name="gpt-5.4",
            cache_policy="static",
            enabled_tools=[],
            max_steps=4,
            timeout_seconds=30.0,
            thinking_enabled=True,
            thinking_effort="medium",
            thinking_verbosity="medium",
            thinking_budget_tokens=None,
            memory=None,
            response_format_config=response_format,
        )

        self.assertEqual(agent.response_format.__name__, "StructuredAnswer")
        self.assertEqual(agent._cache_policy.value, "static")


class OutputExtractorTests(unittest.IsolatedAsyncioTestCase):
    async def test_tracked_agent_tool_applies_declared_output_extractor(self) -> None:
        tracker = MultiAgentUsageTracker()
        agent_shell = create_react_agent(
            system_prompt="你是测试专家",
            agent_name="researcher",
            provider="openai",
            model_name="gpt-5.4-mini",
            enabled_tools=[],
            max_steps=4,
            timeout_seconds=30.0,
            thinking_enabled=False,
            thinking_effort=None,
            thinking_verbosity=None,
            thinking_budget_tokens=None,
            memory=None,
        )

        tool = TrackedAgentTool(
            agent_shell,
            tracker=tracker,
            agent_name="researcher",
            model_name="gpt-5.4-mini",
            pricing_model=None,
            name="researcher",
            description="负责调研",
            output_extractor=build_output_extractor(
                OutputExtractorConfig(mode="field", field_path="details.source_count")
            ),
        )
        
        class _FakeRuntimeAgent:
            def __init__(self) -> None:
                self.usage = {}

            def fork(self):
                return self

            async def __call__(self, request: str):
                del request
                self.usage = {"total_tokens": 10}
                return {
                    "summary": "提炼后的结论",
                    "details": {"source_count": 5},
                }

        tool._agent = _FakeRuntimeAgent()

        result = await tool._invoke(request="请压缩输出")

        self.assertEqual(result, "5")


if __name__ == "__main__":
    unittest.main()
