from __future__ import annotations

import os
from typing import Literal

from motus.models.anthropic_client import AnthropicChatClient
from motus.models.gemini_client import GeminiChatClient
from motus.models.openrouter_client import OpenRouterChatClient

from core.llm.openai_client import ConfigurableOpenAIChatClient
from core.schemas.model_client import ModelClientConfig


LlmProvider = Literal["openai", "anthropic", "gemini", "openrouter"]


def create_chat_client(
    *,
    provider: LlmProvider,
    default_verbosity: str | None = None,
    default_reasoning_effort: str | None = "medium",
    model_client: ModelClientConfig | None = None,
):
    """按 provider 构造 Motus chat client。"""

    override = model_client or ModelClientConfig()

    def _resolve_api_key(default_env_var: str) -> str | None:
        if override.enabled() and override.api_key_env_var:
            return os.getenv(override.api_key_env_var)
        return os.getenv(default_env_var)

    def _resolve_base_url(default_env_var: str) -> str | None:
        if override.enabled() and override.base_url:
            return override.base_url
        return os.getenv(default_env_var)

    if provider == "openai":
        return ConfigurableOpenAIChatClient(
            api_key=_resolve_api_key("OPENAI_API_KEY"),
            base_url=_resolve_base_url("OPENAI_BASE_URL"),
            default_verbosity=default_verbosity,
            default_reasoning_effort=default_reasoning_effort,
        )

    if provider == "anthropic":
        return AnthropicChatClient(
            api_key=_resolve_api_key("ANTHROPIC_API_KEY"),
        )

    if provider == "gemini":
        return GeminiChatClient(
            api_key=_resolve_api_key("GEMINI_API_KEY"),
            vertexai=os.getenv("GEMINI_VERTEXAI", "0") == "1",
            project=os.getenv("GEMINI_PROJECT"),
            location=os.getenv("GEMINI_LOCATION"),
        )

    if provider == "openrouter":
        return OpenRouterChatClient(
            api_key=_resolve_api_key("OPENROUTER_API_KEY"),
            base_url=_resolve_base_url("OPENROUTER_BASE_URL"),
        )

    raise ValueError(f"未知 provider: {provider}")
