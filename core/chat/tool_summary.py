from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from typing import Any

from openai import AsyncOpenAI

from core.config.env import load_project_env
from core.schemas.tool_message import ToolMessageSummaryResponse


load_project_env()

DEFAULT_TOOL_SUMMARY_MODEL = os.getenv("TOOL_SUMMARY_MODEL", "gpt-5.4-mini")


@dataclass(frozen=True)
class CachedToolSummary:
    summary: str
    tool_name: str


class ToolMessageSummaryService:
    def __init__(self, *, model_name: str = DEFAULT_TOOL_SUMMARY_MODEL) -> None:
        self.model_name = model_name
        self._client = AsyncOpenAI(
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url=os.getenv("OPENAI_BASE_URL"),
        )
        self._cache: dict[str, CachedToolSummary] = {}

    def _cache_key(self, tool_name: str, content: str) -> str:
        return hashlib.sha256(f"{tool_name}\0{content}".encode("utf-8")).hexdigest()

    def _fallback_summary(self, tool_name: str, content: str) -> str:
        first_line = next((line.strip() for line in content.splitlines() if line.strip()), "")
        if first_line.startswith("Skill directory:"):
            return f"已加载 {tool_name} skill 说明"
        if tool_name == "web_search":
            return "已检索网页结果"
        if first_line:
            return first_line[:40]
        return f"{tool_name} 工具消息"

    def _truncate(self, text: str, limit: int = 4000) -> str:
        if len(text) <= limit:
            return text
        return f"{text[:limit]}\n\n[内容已截断，共 {len(text)} 字符]"

    def _prepare_prompt_content(self, tool_name: str, content: str) -> str:
        normalized = content.strip().strip('"')
        if tool_name == "web_search":
            try:
                payload = json.loads(normalized)
            except json.JSONDecodeError:
                return self._truncate(normalized)

            web_items = payload.get("web") if isinstance(payload, dict) else None
            if not isinstance(web_items, list):
                return self._truncate(normalized)

            lines = []
            for index, item in enumerate(web_items[:8], start=1):
                if not isinstance(item, dict):
                    continue
                title = str(item.get("title", "")).strip()
                description = str(item.get("description", "")).strip()
                url = str(item.get("url", "")).strip()
                lines.append(f"{index}. {title}\n描述: {description}\n链接: {url}")
            return "\n\n".join(lines) or self._truncate(normalized)

        if tool_name == "load_skill":
            lines = normalized.splitlines()
            selected_lines = lines[:80]
            return self._truncate("\n".join(selected_lines), limit=5000)

        return self._truncate(normalized)

    async def summarize(self, *, tool_name: str, content: str) -> ToolMessageSummaryResponse:
        cache_key = self._cache_key(tool_name, content)
        cached = self._cache.get(cache_key)
        if cached is not None:
            return ToolMessageSummaryResponse(
                tool_name=cached.tool_name,
                summary=cached.summary,
                model_name=self.model_name,
                cached=True,
            )

        prepared_content = self._prepare_prompt_content(tool_name, content)
        fallback = self._fallback_summary(tool_name, content)

        try:
            response = await self._client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "你是一个前端工具消息摘要器。"
                            "请把工具输出总结成一句简体中文短摘要，用于折叠态标题。"
                            "要求：不超过28个汉字；不要加引号；不要解释；不要换行；"
                            "突出结果、用途或错误原因。"
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"工具名：{tool_name}\n"
                            f"工具输出：\n{prepared_content}\n\n"
                            "请输出一句短摘要。"
                        ),
                    },
                ],
                temperature=0.2,
                max_completion_tokens=48,
            )
            summary = (response.choices[0].message.content or "").strip().replace("\n", " ")
            if not summary:
                summary = fallback
        except Exception:
            summary = fallback

        summary = summary[:48].strip() or fallback
        self._cache[cache_key] = CachedToolSummary(summary=summary, tool_name=tool_name)
        return ToolMessageSummaryResponse(
            tool_name=tool_name,
            summary=summary,
            model_name=self.model_name,
            cached=False,
        )
