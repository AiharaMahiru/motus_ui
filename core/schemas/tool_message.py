from pydantic import BaseModel, Field


class ToolMessageSummaryRequest(BaseModel):
    tool_name: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)


class ToolMessageSummaryResponse(BaseModel):
    tool_name: str
    summary: str
    model_name: str
    cached: bool = False
