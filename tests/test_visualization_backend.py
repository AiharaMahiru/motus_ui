import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from motus.models import ChatMessage

from core.schemas.session import SessionCreateRequest
from core.chat import ChatSession
from core.visualization import (
    DataAnalysisWorkflowService,
    VisualizationPolicyService,
    VisualizationProtocolService,
)


class DataAnalysisWorkflowServiceTests(unittest.TestCase):
    def test_inspect_csv_extracts_columns_and_chart_hints(self) -> None:
        service = DataAnalysisWorkflowService()

        with TemporaryDirectory() as temp_dir:
            csv_path = Path(temp_dir) / "daily_metrics.csv"
            csv_path.write_text(
                "date,channel,visits,orders\n"
                "2026-04-01,ads,100,6\n"
                "2026-04-02,organic,120,8\n",
                encoding="utf-8",
            )

            profiles = service.inspect_attachments(
                [
                    {
                        "file_name": csv_path.name,
                        "file_path": str(csv_path),
                    }
                ]
            )

        self.assertEqual(len(profiles), 1)
        profile = profiles[0]
        self.assertIn("date", profile.columns)
        self.assertIn("visits", profile.numeric_fields)
        self.assertIn("date", profile.time_fields)
        self.assertIn("bar", profile.suggested_visualizations)
        self.assertIn("line", profile.suggested_visualizations)


class VisualizationPolicyServiceTests(unittest.TestCase):
    def test_decide_prefers_inline_visualization_for_data_analysis(self) -> None:
        decision = VisualizationPolicyService().decide(
            content="请分析这个数据的趋势和分布，并给出图表",
            attachments=[],
            dataset_profiles=[],
            enabled_tools=["bash", "load_skill"],
        )

        self.assertEqual(decision.goal, "data_analysis")
        self.assertTrue(decision.should_load_skill)
        self.assertTrue(decision.should_enhance_response)
        self.assertIn("line", decision.preferred_visuals)


class VisualizationProtocolServiceTests(unittest.TestCase):
    def test_sanitize_chartjs_viz_into_supported_schema(self) -> None:
        service = VisualizationProtocolService()
        result = service.sanitize(
            "```viz\n"
            + json.dumps(
                {
                    "type": "line",
                    "title": "调用量",
                    "data": {
                        "labels": ["周一", "周二"],
                        "datasets": [
                            {
                                "label": "tool_calls",
                                "data": [3, 5],
                            }
                        ],
                    },
                },
                ensure_ascii=False,
            )
            + "\n```"
        )

        self.assertIn('"x": [', result.content)
        self.assertIn('"series": [', result.content)
        self.assertNotIn('"datasets"', result.content)
        self.assertEqual(result.warnings, [])

    def test_invalid_mermaid_downgrades_to_text_block(self) -> None:
        service = VisualizationProtocolService()
        result = service.sanitize("```mermaid\nnot_a_real_diagram\nA-->B\n```")

        self.assertIn("```text", result.content)
        self.assertIn("已自动校正部分内嵌图表协议", result.content)
        self.assertTrue(result.warnings)


class FakeMemory:
    def __init__(self) -> None:
        self.messages: list[ChatMessage] = []
        self._messages = self.messages
        self._system_prompt = ""
        self.config = type("Config", (), {})()


class FakeAgent:
    def __init__(self) -> None:
        self.memory = FakeMemory()
        self.usage: dict = {}
        self.context_window_usage: dict = {}
        self._last_assistant: ChatMessage | None = None

    async def add_message(self, message: ChatMessage) -> None:
        self.memory.messages.append(message)

    async def __call__(self, content: str | None) -> str:
        if content:
            self.memory.messages.append(ChatMessage.user_message(content))
        assistant = ChatMessage.assistant_message("这是原始分析回答。")
        self.memory.messages.append(assistant)
        self._last_assistant = assistant
        return assistant.content or ""

    def get_last_assistant_message(self) -> ChatMessage | None:
        return self._last_assistant


class FakeRewriteService:
    async def maybe_rewrite(self, *, user_content: str, assistant_content: str, decision, dataset_context=None) -> str:
        return (
            f"{assistant_content}\n\n"
            "```viz\n"
            '{\n  "type": "line",\n  "title": "趋势补充",\n  "x": ["周一", "周二"],\n'
            '  "series": [{ "name": "value", "data": [2, 4] }]\n'
            "}\n```"
        )


class ChatSessionVisualizationIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def test_ask_applies_visualization_guidance_and_post_processing(self) -> None:
        fake_agent = FakeAgent()

        def fake_build_agent(self, *, config, memory=None, root_usage=None, specialist_ledgers=None):  # type: ignore[no-untyped-def]
            self.config = config
            self.agent = fake_agent
            self.specialist_usage_tracker = self.specialist_usage_tracker

        with patch.object(ChatSession, "_build_agent", fake_build_agent):
            session = ChatSession.create(
                SessionCreateRequest(enabled_tools=["bash", "load_skill"]),
                visualization_rewrite_service=FakeRewriteService(),  # type: ignore[arg-type]
            )

            result = await session.ask("请分析性能趋势，并给一个图表。")

        self.assertIn("```viz", result.assistant.content or "")
        user_messages = [message for message in session.history() if message.role == "user"]
        self.assertTrue(user_messages)
        self.assertEqual(user_messages[-1].user_params.get("display_content"), "请分析性能趋势，并给一个图表。")
        self.assertIn("[系统补充指引，仅对本轮生效]", user_messages[-1].content or "")


if __name__ == "__main__":
    unittest.main()
