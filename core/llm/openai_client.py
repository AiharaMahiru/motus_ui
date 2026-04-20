from __future__ import annotations

from typing import Any, Optional, Type

from openai._types import NOT_GIVEN
from openai.lib.streaming.chat import AsyncChatCompletionStreamManager
from pydantic import BaseModel

from motus.models.base import ChatMessage, ReasoningConfig, ToolDefinition
from motus.models.openai_client import OpenAIChatClient


class ConfigurableOpenAIChatClient(OpenAIChatClient):
    def __init__(
        self,
        *,
        default_verbosity: str | None = None,
        default_reasoning_effort: str | None = "medium",
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self._default_verbosity = default_verbosity
        self._default_reasoning_effort = default_reasoning_effort

    def _convert_messages(self, messages: list[ChatMessage]) -> list[dict]:
        """为 OpenAI Chat Completions 补齐多图输入支持。"""

        openai_messages: list[dict[str, Any]] = []
        for msg in messages:
            if msg.role == "system":
                openai_messages.append({"role": "system", "content": msg.content})
                continue
            if msg.role == "user":
                content_parts: list[dict[str, Any]] = []
                if msg.content:
                    content_parts.append({"type": "text", "text": msg.content})

                image_payloads: list[dict[str, Any]] = []
                if msg.base64_image:
                    image_payloads.append(
                        {
                            "mime_type": "image/png",
                            "base64_data": msg.base64_image,
                        }
                    )
                user_images = msg.user_params.get("images") if isinstance(msg.user_params, dict) else None
                if isinstance(user_images, list):
                    image_payloads.extend(
                        item
                        for item in user_images
                        if isinstance(item, dict) and item.get("base64_data")
                    )

                for image in image_payloads:
                    mime_type = str(image.get("mime_type") or "image/png")
                    base64_data = str(image.get("base64_data") or "").strip()
                    if not base64_data:
                        continue
                    content_parts.append(
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64_data}",
                            },
                        }
                    )

                if content_parts:
                    openai_messages.append({"role": "user", "content": content_parts})
                else:
                    openai_messages.append({"role": "user", "content": msg.content or ""})
                continue
            if msg.role == "assistant":
                assistant_msg: dict[str, Any] = {"role": "assistant", "content": msg.content}
                if msg.tool_calls:
                    assistant_msg["tool_calls"] = [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments,
                            },
                        }
                        for tc in msg.tool_calls
                    ]
                openai_messages.append(assistant_msg)
                continue
            if msg.role == "tool":
                openai_messages.append(
                    {
                        "role": "tool",
                        "content": msg.content,
                        "tool_call_id": msg.tool_call_id,
                    }
                )

        return openai_messages

    def _apply_reasoning_options(
        self,
        request_kwargs: dict[str, Any],
        reasoning: ReasoningConfig,
    ) -> None:
        if "reasoning_effort" not in request_kwargs:
            if not reasoning.enabled:
                request_kwargs["reasoning_effort"] = "none"
            else:
                effort = reasoning.effort or self._default_reasoning_effort
                if effort:
                    request_kwargs["reasoning_effort"] = effort

        if self._default_verbosity and "verbosity" not in request_kwargs:
            request_kwargs["verbosity"] = self._default_verbosity

    async def create(
        self,
        model: str,
        messages: list[ChatMessage],
        tools: Optional[list[ToolDefinition]] = None,
        reasoning: ReasoningConfig = ReasoningConfig.auto(),
        **kwargs: Any,
    ):
        request_kwargs = {
            "model": model,
            "messages": self._convert_messages(messages),
            **kwargs,
        }

        if tools:
            request_kwargs["tools"] = self._convert_tools(tools)

        self._apply_reasoning_options(request_kwargs, reasoning)

        request_kwargs["stream"] = True
        request_kwargs["stream_options"] = {"include_usage": True}
        api_request = self._client.chat.completions.create(**request_kwargs)
        manager = AsyncChatCompletionStreamManager(
            api_request,
            response_format=NOT_GIVEN,
            input_tools=NOT_GIVEN,
        )
        async with manager as stream:
            response = await stream.get_final_completion()

        return self._parse_response(response, model)

    async def parse(
        self,
        model: str,
        messages: list[ChatMessage],
        response_format: Type[BaseModel],
        tools: Optional[list[ToolDefinition]] = None,
        reasoning: ReasoningConfig = ReasoningConfig.auto(),
        **kwargs: Any,
    ):
        request_kwargs = {
            "model": model,
            "messages": self._convert_messages(messages),
            "response_format": response_format,
            **kwargs,
        }

        if tools:
            request_kwargs["tools"] = self._convert_tools(tools)

        self._apply_reasoning_options(request_kwargs, reasoning)
        response = await self._client.beta.chat.completions.parse(**request_kwargs)
        completion = self._parse_response(response, model)
        completion.parsed = getattr(response.choices[0].message, "parsed", None)
        return completion
