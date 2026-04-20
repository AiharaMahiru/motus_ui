import unittest

from motus.models import ChatMessage

from core.llm.openai_client import ConfigurableOpenAIChatClient


class OpenAiClientMessageConversionTests(unittest.TestCase):
    def test_convert_messages_supports_multiple_images(self) -> None:
        client = ConfigurableOpenAIChatClient(api_key="test-key")
        messages = [
            ChatMessage(
                role="user",
                content="请看这两张图",
                user_params={
                    "images": [
                        {"mime_type": "image/png", "base64_data": "YWJj"},
                        {"mime_type": "image/jpeg", "base64_data": "ZGVm"},
                    ]
                },
            )
        ]

        converted = client._convert_messages(messages)

        self.assertEqual(converted[0]["role"], "user")
        self.assertIsInstance(converted[0]["content"], list)
        self.assertEqual(converted[0]["content"][0]["type"], "text")
        self.assertEqual(converted[0]["content"][1]["image_url"]["url"], "data:image/png;base64,YWJj")
        self.assertEqual(converted[0]["content"][2]["image_url"]["url"], "data:image/jpeg;base64,ZGVm")


if __name__ == "__main__":
    unittest.main()
