from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

from .analysis import DatasetProfile


DATA_ANALYSIS_HINTS = (
    "数据分析",
    "分析",
    "趋势",
    "同比",
    "环比",
    "占比",
    "分布",
    "相关性",
    "漏斗",
    "热力",
    "指标",
    "报表",
    "统计",
    "图表",
    "k线",
    "k 线",
)

DIAGRAM_HINTS = (
    "流程图",
    "流程",
    "架构图",
    "架构",
    "算法图",
    "算法",
    "时序图",
    "时序",
    "状态图",
    "状态机",
    "拓扑",
    "关系图",
    "类图",
    "er",
    "甘特",
    "思维导图",
    "模块图",
    "分层",
)


@dataclass(slots=True)
class VisualizationPolicyDecision:
    goal: str = "none"
    should_load_skill: bool = False
    should_enhance_response: bool = False
    max_visual_blocks: int = 0
    preferred_visuals: list[str] = field(default_factory=list)
    instructions: list[str] = field(default_factory=list)

    def has_instructions(self) -> bool:
        return bool(self.instructions)


class VisualizationPolicyService:
    """根据当前会话内容生成可视化策略。"""

    def decide(
        self,
        *,
        content: str,
        attachments: list[dict] | None,
        dataset_profiles: list[DatasetProfile] | None,
        enabled_tools: Iterable[str],
    ) -> VisualizationPolicyDecision:
        normalized = content.strip().lower()
        enabled_tool_names = set(enabled_tools)
        has_dataset = bool(dataset_profiles)

        data_intent = has_dataset or any(token in normalized for token in DATA_ANALYSIS_HINTS)
        diagram_intent = any(token in normalized for token in DIAGRAM_HINTS)

        if data_intent and diagram_intent:
            goal = "mixed"
        elif data_intent:
            goal = "data_analysis"
        elif diagram_intent:
            goal = "diagram"
        else:
            return VisualizationPolicyDecision()

        preferred_visuals: list[str] = []
        instructions: list[str] = []

        if goal in {"data_analysis", "mixed"}:
            instructions.append("如果需要做数据分析，先用 Python 做清洗、聚合、统计和派生指标，再在最终回答中输出 1 到 2 个合法 viz 代码块。")
            instructions.append("viz 代码块必须使用当前会话支持的结构化 schema，不要输出 Chart.js 风格的 labels/datasets。")
            preferred_visuals.extend(
                self._collect_profile_suggestions(dataset_profiles or [])
                or ["line", "bar", "scatter", "heatmap", "funnel"]
            )

        if goal in {"diagram", "mixed"}:
            instructions.append("如果需要解释流程、架构、算法、状态、时序或分层关系，优先使用 Mermaid 官方语法。")
            instructions.append("Mermaid 优先选择 flowchart、sequenceDiagram、stateDiagram-v2、architecture-beta、block-beta、gantt、mindmap 等标准图种。")
            preferred_visuals.extend(["flowchart", "architecture-beta", "sequenceDiagram", "block-beta"])

        if "load_skill" in enabled_tool_names:
            instructions.append("本轮任务适合优先调用 load_skill('inline_visualization') 获取输出约束和示例。")

        deduped_visuals: list[str] = []
        for name in preferred_visuals:
            if name not in deduped_visuals:
                deduped_visuals.append(name)

        return VisualizationPolicyDecision(
            goal=goal,
            should_load_skill="load_skill" in enabled_tool_names,
            should_enhance_response=True,
            max_visual_blocks=2 if goal != "mixed" else 3,
            preferred_visuals=deduped_visuals[:6],
            instructions=instructions,
        )

    def _collect_profile_suggestions(self, profiles: list[DatasetProfile]) -> list[str]:
        suggestions: list[str] = []
        for profile in profiles:
            for item in profile.suggested_visualizations:
                if item not in suggestions:
                    suggestions.append(item)
        return suggestions
