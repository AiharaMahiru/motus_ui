from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


RuntimeCategory = Literal["tool", "mcp", "skill", "shared"]
RuntimeRequirementType = Literal["binary", "env", "module", "service", "file", "stack"]
RuntimeStatus = Literal["ready", "missing", "manual"]


class RuntimeRequirementSummary(BaseModel):
    """单个运行时依赖的可序列化描述。"""

    key: str
    label: str
    category: RuntimeCategory
    requirement_type: RuntimeRequirementType
    summary: str
    install_hint: str
    required_by: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    binaries: list[str] = Field(default_factory=list)
    env_vars: list[str] = Field(default_factory=list)
    modules: list[str] = Field(default_factory=list)
    files: list[str] = Field(default_factory=list)
    manual: bool = False


class RuntimeCheckSummary(BaseModel):
    """单个运行时依赖的检测结果。"""

    requirement: RuntimeRequirementSummary
    status: RuntimeStatus
    detail: str


class RuntimeRequirementsResponse(BaseModel):
    """运行时依赖总览。"""

    generated_at: str
    project_root: str
    ready_count: int
    missing_count: int
    manual_count: int
    checks: list[RuntimeCheckSummary] = Field(default_factory=list)
