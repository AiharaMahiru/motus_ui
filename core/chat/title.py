from __future__ import annotations

import os
import re
from typing import Iterable

from openai import AsyncOpenAI

from motus.models import ChatMessage

from core.config.env import load_project_env


load_project_env()

DEFAULT_SESSION_TITLE_MODEL = os.getenv("SESSION_TITLE_MODEL", "gpt-5.4-mini")


class SessionTitleService:
    """用轻量模型为会话生成简短标题。"""

    def __init__(self, *, model_name: str = DEFAULT_SESSION_TITLE_MODEL) -> None:
        self.model_name = model_name
        self._enabled = bool(os.getenv("OPENAI_API_KEY"))
        self._client = AsyncOpenAI(
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url=os.getenv("OPENAI_BASE_URL"),
        )

    def _normalize_text(self, text: str, *, limit: int = 240) -> str:
        normalized = text.replace("\r", "\n").strip()
        normalized = re.sub(r"\n{2,}", "\n", normalized)
        normalized = re.sub(r"[ \t]+", " ", normalized)
        normalized = normalized.strip("`\"' ")
        return normalized[:limit]

    def _normalize_title(self, title: str) -> str | None:
        normalized = self._normalize_text(title, limit=32).replace("\n", " ")
        normalized = re.sub(r"^[#>*\-\d\s.、:：]+", "", normalized)
        normalized = normalized.strip("「」『』【】[]()（）`\"' ")
        normalized = normalized.rstrip("，,。:：;；… ")
        normalized = re.sub(r"\s{2,}", " ", normalized)
        return normalized[:24] if normalized else None

    def _iter_relevant_messages(self, messages: Iterable[ChatMessage]) -> Iterable[str]:
        for message in messages:
            if message.role not in {"user", "assistant"}:
                continue
            if not isinstance(message.content, str):
                continue
            content = self._normalize_text(message.content)
            if not content:
                continue
            yield f"{message.role}: {content}"

    def _fallback_title(self, messages: list[ChatMessage], *, session_id: str) -> str:
        for message in messages:
            if message.role != "user" or not isinstance(message.content, str):
                continue
            first_line = next((line.strip() for line in message.content.splitlines() if line.strip()), "")
            if not first_line:
                continue
            simplified = re.sub(r"^(请|请你|帮我|麻烦你|麻烦|能否|可以|现在|接下来)+", "", first_line).strip()
            simplified = re.split(r"[。！？!?；;]", simplified, maxsplit=1)[0].strip()
            title = self._normalize_title(simplified)
            if title:
                return title
        return f"会话 {session_id[:8]}"

    def fallback_title(self, *, messages: list[ChatMessage], session_id: str) -> str:
        """公开同步兜底标题，供恢复历史会话时直接补标题。"""

        return self._fallback_title(messages, session_id=session_id)

    async def generate(self, *, messages: list[ChatMessage], session_id: str) -> str:
        prepared_messages = list(self._iter_relevant_messages(messages))
        fallback = self._fallback_title(messages, session_id=session_id)
        if not prepared_messages or not self._enabled:
            return fallback

        transcript = "\n".join(prepared_messages[-8:])

        try:
            response = await self._client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "你是一个会话标题生成器。"
                            "请基于对话主题生成一个简体中文短标题。"
                            "要求：8 到 18 个汉字优先；不要使用书名号和引号；"
                            "不要出现“帮我”“请”“关于”等口语前缀；不要换行。"
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"请为这段对话生成标题：\n{transcript}",
                    },
                ],
                temperature=0.2,
                max_completion_tokens=32,
                timeout=12,
            )
            title = self._normalize_title(response.choices[0].message.content or "")
            return title or fallback
        except Exception:
            return fallback
