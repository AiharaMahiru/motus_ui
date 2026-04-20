from __future__ import annotations

import os

from openai import AsyncOpenAI

from core.config.env import load_project_env
from .policy import VisualizationPolicyDecision
from .protocol import VisualizationProtocolService


load_project_env()

DEFAULT_VISUALIZATION_REWRITE_MODEL = os.getenv("VISUALIZATION_REWRITE_MODEL", "gpt-5.4-mini")


class VisualizationRewriteService:
    """使用轻量模型把适合图形化的最终回答增强为 mermaid / viz。"""

    def __init__(
        self,
        *,
        protocol_service: VisualizationProtocolService | None = None,
        model_name: str = DEFAULT_VISUALIZATION_REWRITE_MODEL,
    ) -> None:
        self.model_name = model_name
        self._enabled = bool(os.getenv("OPENAI_API_KEY"))
        self._protocol_service = protocol_service or VisualizationProtocolService()
        self._client = AsyncOpenAI(
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url=os.getenv("OPENAI_BASE_URL"),
        )

    async def maybe_rewrite(
        self,
        *,
        user_content: str,
        assistant_content: str,
        decision: VisualizationPolicyDecision,
        dataset_context: str | None = None,
    ) -> str:
        if not self._enabled or not decision.should_enhance_response:
            return self._protocol_service.sanitize(assistant_content).content

        if "```viz" in assistant_content or "```mermaid" in assistant_content:
            return self._protocol_service.sanitize(assistant_content).content

        if len(assistant_content.strip()) < 80:
            return self._protocol_service.sanitize(assistant_content).content

        prompt_lines = [
            "你是会话回答后处理器。",
            "请在不改变原始结论的前提下，必要时把回答增强为更直观的简体中文结果。",
            f"最多允许插入 {decision.max_visual_blocks} 个可视化代码块。",
            "只允许使用两种代码块：```mermaid 或 ```viz。",
            "viz 必须是合法 JSON，且只能使用当前支持的结构：",
            "- line / bar / area: {type, x, series:[{name, data}]}",
            "- pie / doughnut / funnel: {type, series:[{data:[{name, value}]}]}",
            "- scatter: {type, series:[{name, points:[{x, y, label?}]}]}",
            "- radar: {type, indicators, series:[{name, data}]}",
            "- heatmap: {type, x, y, values:[[xIndex, yIndex, value]]}",
            "- gauge: {type, min?, max?, series:[{name?, value, detail?}]}",
            "- sankey: {type, series:[{nodes, links}]}",
            "- candlestick: {type, x, series:[{data:[[open, close, low, high]]}]}",
            "Mermaid 必须使用官方标准图种。",
            "如果原回答不适合加图，不要硬加图，直接返回原回答。",
            "不要解释你做了后处理。",
        ]
        if decision.preferred_visuals:
            prompt_lines.append(f"优先图型建议：{', '.join(decision.preferred_visuals)}")
        if dataset_context:
            prompt_lines.append(f"数据上下文：\n{dataset_context}")

        try:
            response = await self._client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": "\n".join(prompt_lines)},
                    {
                        "role": "user",
                        "content": (
                            f"用户请求：\n{user_content}\n\n"
                            f"原始回答：\n{assistant_content}\n\n"
                            "请输出增强后的最终回答。"
                        ),
                    },
                ],
                temperature=0.15,
                max_completion_tokens=900,
                timeout=15,
            )
            rewritten = (response.choices[0].message.content or "").strip()
            if not rewritten:
                rewritten = assistant_content
        except Exception:
            rewritten = assistant_content

        return self._protocol_service.sanitize(rewritten).content
