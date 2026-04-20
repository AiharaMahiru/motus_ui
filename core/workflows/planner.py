from __future__ import annotations

import os
from typing import cast

from motus.models.base import ChatMessage, ReasoningConfig

from core.config.env import load_project_env
from core.llm.openai_client import ConfigurableOpenAIChatClient
from core.schemas.workflow import (
    WorkflowDefinitionSummary,
    WorkflowPlannerPlan,
)


load_project_env()

DEFAULT_WORKFLOW_PLANNER_MODEL = os.getenv("WORKFLOW_PLANNER_MODEL", "gpt-5.4")


class WorkflowPlanner:
    """用 LLM 把自然语言目标映射成可执行 workflow 计划。"""

    def __init__(self, *, model_name: str = DEFAULT_WORKFLOW_PLANNER_MODEL) -> None:
        self.model_name = model_name
        self.client = ConfigurableOpenAIChatClient(
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url=os.getenv("OPENAI_BASE_URL"),
            default_reasoning_effort="medium",
            default_verbosity="medium",
        )

    async def plan(
        self,
        *,
        goal: str,
        workflows: list[WorkflowDefinitionSummary],
    ) -> WorkflowPlannerPlan:
        if not workflows:
            raise RuntimeError("当前没有可供编排的 workflow 定义")

        workflow_catalog = "\n\n".join(
            [
                (
                    f"Workflow: {workflow.name}\n"
                    f"Description: {workflow.description}\n"
                    f"Input schema: {workflow.input_schema}"
                )
                for workflow in workflows
            ]
        )

        completion = await self.client.parse(
            model=self.model_name,
            messages=[
                ChatMessage.system_message(
                    content=(
                        "你是一个 workflow 编排代理。\n"
                        "你的职责：根据用户目标，从候选 workflow 中选择最合适的一项，"
                        "并自动补全尽可能合理的 input_payload。\n\n"
                        "约束：\n"
                        "1. 只能选择候选列表里的 workflow_name。\n"
                        "2. input_payload 必须尽量贴合该 workflow 的 input_schema。\n"
                        "3. 如果用户信息不足，仍然给出一个可执行的最小 payload，"
                        "   同时把缺失信息写进 missing_information，把假设写进 warnings。\n"
                        "4. candidate_workflows 按考虑优先级给出 1-3 个名称。\n"
                        "5. reason 说明为什么当前 workflow 最匹配。\n"
                        "6. 全部使用简体中文。"
                    )
                ),
                ChatMessage.user_message(
                    content=(
                        f"用户目标：\n{goal}\n\n"
                        f"候选 workflow 列表：\n{workflow_catalog}"
                    )
                ),
            ],
            response_format=WorkflowPlannerPlan,
            reasoning=ReasoningConfig(
                enabled=True,
                effort="medium",
            ),
        )

        parsed = getattr(completion, "parsed", None)
        if parsed is None:
            raise RuntimeError("workflow planner 没有返回结构化结果")

        plan = cast(WorkflowPlannerPlan, parsed)
        valid_names = {workflow.name for workflow in workflows}
        if plan.workflow_name not in valid_names:
            raise RuntimeError(f"workflow planner 选择了未知 workflow: {plan.workflow_name}")

        if not plan.candidate_workflows:
            plan.candidate_workflows = [plan.workflow_name]
        else:
            plan.candidate_workflows = [name for name in plan.candidate_workflows if name in valid_names][:3] or [plan.workflow_name]

        return plan
