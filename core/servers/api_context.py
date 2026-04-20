from __future__ import annotations

from dataclasses import dataclass

from core.chat import ChatService, ToolMessageSummaryService
from core.backends.base import SessionBackend
from core.preview import PreviewService
from core.services.system import SystemService
from core.services.tracing import TracingService
from core.workflows import WorkflowService


@dataclass
class ApiServices:
    """集中传递 API 依赖，避免单个 router 再继续闭包膨胀。"""

    session_backend: SessionBackend
    chat_service: ChatService | None
    system_service: SystemService
    tracing_service: TracingService
    workflow_service: WorkflowService
    tool_message_summary_service: ToolMessageSummaryService
    preview_service: PreviewService
