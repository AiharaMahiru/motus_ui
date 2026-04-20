from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class WorkflowHostDescriptor(BaseModel):
    """对外暴露的 workflow 宿主描述。"""

    name: str
    source: str = "builtin"
    persistence: Literal["memory", "filesystem"] = "memory"
    description: str | None = None


class WorkflowCatalogResponse(BaseModel):
    workflows: list[WorkflowHostDescriptor] = Field(default_factory=list)
