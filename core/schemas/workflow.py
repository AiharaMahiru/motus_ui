from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


WorkflowRunStatus = Literal[
    "queued",
    "running",
    "completed",
    "cancelled",
    "terminated",
    "error",
]


class WorkflowDefinitionSummary(BaseModel):
    name: str
    description: str
    input_schema: dict[str, Any]


class WorkflowPlannerRequest(BaseModel):
    goal: str = Field(..., min_length=1, description="用户用自然语言描述的编排目标")


class WorkflowPlannerPlan(BaseModel):
    workflow_name: str = Field(..., description="agent 选择的 workflow 名称")
    input_payload: dict[str, Any] = Field(default_factory=dict, description="agent 自动补全后的 workflow 输入")
    reason: str = Field(..., description="为什么选择这个 workflow")
    confidence: Literal["low", "medium", "high"] = Field(default="medium", description="当前规划置信度")
    missing_information: list[str] = Field(default_factory=list, description="仍然缺失但可继续推进的信息")
    warnings: list[str] = Field(default_factory=list, description="规划时的风险提示")
    candidate_workflows: list[str] = Field(default_factory=list, description="本轮考虑过的 workflow 候选")


class WorkflowPlannerResponse(BaseModel):
    goal: str
    generated_at: str
    plan: WorkflowPlannerPlan


class WorkflowRuntimeConfig(BaseModel):
    timeout_seconds: float | None = Field(default=None, gt=0, description="单次 workflow run 的超时时间")
    max_retries: int = Field(default=0, ge=0, description="失败后的最大重试次数")
    retry_delay_seconds: float = Field(default=0.0, ge=0, description="两次重试之间的等待秒数")


class WorkflowRunRequest(BaseModel):
    workflow_name: str = Field(..., description="要执行的 workflow 名称")
    input_payload: dict[str, Any] = Field(default_factory=dict, description="workflow 输入")
    runtime: WorkflowRuntimeConfig = Field(default_factory=WorkflowRuntimeConfig, description="workflow 运行策略")


class WorkflowRunSummary(BaseModel):
    run_id: str
    workflow_name: str
    status: WorkflowRunStatus
    created_at: str
    updated_at: str
    launch_mode: Literal["manual", "agent"] = "manual"
    user_goal: str | None = None
    planner_generated_at: str | None = None
    planner_reason: str | None = None
    planner_confidence: Literal["low", "medium", "high"] | None = None
    planner_warnings: list[str] = Field(default_factory=list)
    planner_missing_information: list[str] = Field(default_factory=list)
    planner_candidate_workflows: list[str] = Field(default_factory=list)
    runtime: WorkflowRuntimeConfig = Field(default_factory=WorkflowRuntimeConfig)
    attempt_count: int = 0
    project_root: str | None = None
    trace_log_dir: str | None = None


class WorkflowRunDetail(WorkflowRunSummary):
    input_payload: dict[str, Any]
    output_payload: dict[str, Any] | None = None
    error: str | None = None


class WorkflowRunControlRequest(BaseModel):
    reason: str | None = Field(default=None, description="取消或终止原因")
