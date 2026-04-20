from __future__ import annotations

from fastapi import APIRouter

from core.schemas.tool_message import ToolMessageSummaryRequest, ToolMessageSummaryResponse
from core.servers.api_context import ApiServices


def create_tool_message_router(services: ApiServices) -> APIRouter:
    router = APIRouter()

    @router.post("/api/tool-messages/summaries", response_model=ToolMessageSummaryResponse)
    async def summarize_tool_message(request: ToolMessageSummaryRequest) -> ToolMessageSummaryResponse:
        return await services.tool_message_summary_service.summarize(
            tool_name=request.tool_name,
            content=request.content,
        )

    return router
