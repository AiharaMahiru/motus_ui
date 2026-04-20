from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ToolDescriptor(BaseModel):
    """对外暴露的工具描述。"""

    name: str
    group: str = "default"
    label: str | None = None
    description: str | None = None
    source: str = "builtin"
    persistence: Literal["memory", "filesystem"] = "memory"
    human_in_the_loop_only: bool = False


class ToolCatalogResponse(BaseModel):
    tools: list[ToolDescriptor] = Field(default_factory=list)
