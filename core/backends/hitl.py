from __future__ import annotations

import asyncio
import base64
from datetime import datetime, timezone
import json
import time
from typing import Any
import uuid

import httpx
from fastapi import UploadFile
from motus.models import ChatMessage

from core.chat.title import SessionTitleService
from core.chat.utils import format_bytes, get_session_upload_dir, sanitize_upload_filename
from core.agents.factory import get_tool_catalog_response
from core.schemas.session import (
    InterruptInfo,
    InterruptResumeRequest,
    MessageResponse,
    SessionCreateRequest,
    SessionDetail,
    SessionMessageDeleteResponse,
    SessionSummary,
    TurnMetrics,
    SessionUpdateRequest,
)
from core.schemas.tool_host import ToolCatalogResponse
from core.schemas.tracing import TraceExportResult, TracingStatus
from core.schemas.workflow_host import WorkflowCatalogResponse
from core.schemas.workflow import (
    WorkflowDefinitionSummary,
    WorkflowRunControlRequest,
    WorkflowPlannerRequest,
    WorkflowPlannerResponse,
    WorkflowRunDetail,
    WorkflowRunRequest,
    WorkflowRunSummary,
)
from core.services.tracing import TracingService
from core.workflows import WorkflowService
from core.workflows.registry import get_workflow_catalog
from core.servers.hitl_telemetry import load_hitl_session_telemetry, save_hitl_session_telemetry


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _metrics_signature(metrics: TurnMetrics | None) -> str | None:
    if metrics is None:
        return None
    return json.dumps(
        metrics.model_dump(exclude_none=True),
        ensure_ascii=False,
        sort_keys=True,
    )


class HitlSessionBackend:
    """HITL server 的 HTTP 适配器。"""

    def __init__(
        self,
        base_url: str,
        *,
        workflow_service: WorkflowService | None = None,
        tracing_service: TracingService | None = None,
        title_service: SessionTitleService | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=15.0)
        self._configs: dict[str, SessionCreateRequest] = {}
        self._workflow_service = workflow_service or WorkflowService()
        self._tracing_service = tracing_service or TracingService()
        self._title_service = title_service or SessionTitleService()

    async def aclose(self) -> None:
        await self._client.aclose()

    async def list_sessions(self) -> list[SessionSummary]:
        runtime_summaries = await self._load_runtime_summaries()
        if runtime_summaries is not None:
            return runtime_summaries

        resp = await self._client.get("/sessions")
        resp.raise_for_status()
        sessions = resp.json()
        result: list[SessionSummary] = []
        for item in sessions:
            session_id = item["session_id"]
            config = await self._ensure_session_config(session_id)
            result.append(
                SessionSummary(
                    session_id=session_id,
                    title=config.title if config else None,
                    status=item["status"],
                    model_name=config.model_name if config else "unknown",
                    created_at="n/a",
                    updated_at="n/a",
                    message_count=item.get("total_messages", 0),
                    total_usage={},
                    total_cost_usd=None,
                    last_error=None,
                    multi_agent_enabled=config.multi_agent.enabled() if config else False,
                    specialist_count=config.multi_agent.specialist_count() if config else 0,
                )
            )
        return result

    async def create_session(self, config: SessionCreateRequest) -> SessionDetail:
        session_id = str(uuid.uuid4())
        resp = await self._client.put(f"/sessions/{session_id}", json={})
        resp.raise_for_status()
        try:
            config_resp = await self._client.put(
                f"/sessions/{session_id}/config",
                json=config.model_dump(exclude_none=True),
            )
            config_resp.raise_for_status()
        except Exception:
            await self._client.delete(f"/sessions/{session_id}")
            raise

        self._configs[session_id] = config
        return await self.get_session(session_id)

    async def update_session(self, session_id: str, update: SessionUpdateRequest) -> SessionDetail:
        resp = await self._client.patch(
            f"/sessions/{session_id}/config",
            json=update.model_dump(exclude_unset=True, exclude_none=True),
        )
        resp.raise_for_status()
        config = SessionCreateRequest.model_validate(resp.json())
        self._configs[session_id] = config
        return await self.get_session(session_id)

    async def get_session(self, session_id: str) -> SessionDetail:
        runtime_detail = await self._load_runtime_detail(session_id)
        if runtime_detail is not None:
            self._configs[session_id] = self._config_from_detail(runtime_detail)
            if not runtime_detail.title and runtime_detail.message_count > 0:
                if await self._ensure_session_title(session_id):
                    refreshed_detail = await self._load_runtime_detail(session_id)
                    if refreshed_detail is not None:
                        self._configs[session_id] = self._config_from_detail(refreshed_detail)
                        return refreshed_detail
            return runtime_detail

        resp = await self._client.get(f"/sessions/{session_id}")
        resp.raise_for_status()
        data = resp.json()
        config = await self._ensure_session_config(session_id) or SessionCreateRequest()
        detail = self._build_detail_from_session_response(
            session_id=session_id,
            data=data,
            config=config,
        )
        if not detail.title and detail.message_count > 0:
            if await self._ensure_session_title(session_id):
                return await self.get_session(session_id)
        return detail

    async def get_session_wait(self, session_id: str, *, timeout: float | None = None) -> SessionDetail:
        params: dict[str, Any] = {"wait": "true"}
        if timeout is not None:
            params["timeout"] = timeout
        resp = await self._client.get(f"/sessions/{session_id}", params=params)
        resp.raise_for_status()
        return await self.get_session(session_id)

    async def backfill_missing_titles(self, *, limit: int = 3) -> int:
        if limit <= 0:
            return 0

        runtime_summaries = await self._load_runtime_summaries()
        candidate_ids: list[str] = []
        if runtime_summaries is not None:
            for item in runtime_summaries:
                if item.title or item.message_count <= 0:
                    continue
                candidate_ids.append(item.session_id)
        else:
            resp = await self._client.get("/sessions")
            resp.raise_for_status()
            for item in resp.json():
                session_id = item["session_id"]
                config = await self._ensure_session_config(session_id) or SessionCreateRequest()
                if config.title or item.get("total_messages", 0) <= 0:
                    continue
                candidate_ids.append(session_id)

        updated = 0
        for session_id in candidate_ids[:limit]:
            if await self._ensure_session_title(session_id):
                updated += 1
        return updated

    def _build_detail_from_session_response(
        self,
        *,
        session_id: str,
        data: dict[str, Any],
        config: SessionCreateRequest,
    ) -> SessionDetail:
        interrupts = data.get("interrupts")
        return SessionDetail(
            session_id=session_id,
            title=config.title,
            status=data["status"],
            provider=config.provider,
            model_client=config.model_client,
            model_name=config.model_name,
            created_at="n/a",
            updated_at=_now_iso(),
            message_count=0,
            total_usage={},
            total_cost_usd=None,
            last_error=data.get("error"),
            system_prompt=config.system_prompt,
            pricing_model=config.pricing_model,
            cache_policy=config.cache_policy,
            max_steps=config.max_steps,
            timeout_seconds=config.timeout_seconds,
            thinking=config.thinking,
            enabled_tools=list(config.enabled_tools),
            mcp_servers=list(config.mcp_servers),
            multi_agent=config.multi_agent,
            sandbox=config.sandbox,
            human_in_the_loop=config.human_in_the_loop,
            approval_tool_names=list(config.approval_tool_names),
            input_guardrails=list(config.input_guardrails),
            output_guardrails=list(config.output_guardrails),
            tool_guardrails=list(config.tool_guardrails),
            response_format=config.response_format,
            memory=config.memory,
            context_window={"percent": "n/a"},
            last_response=ChatMessage.model_validate(data["response"]) if data.get("response") else None,
            interrupts=[InterruptInfo.model_validate(item) for item in interrupts] if interrupts else None,
            multi_agent_enabled=config.multi_agent.enabled(),
            specialist_count=config.multi_agent.specialist_count(),
            resume_supported=bool(interrupts),
        )

    async def _ensure_session_title(self, session_id: str) -> bool:
        config = await self._ensure_session_config(session_id) or SessionCreateRequest()
        if config.title:
            return False

        messages = await self.get_messages(session_id)
        if not messages:
            return False

        title = await self._title_service.generate(messages=messages, session_id=session_id)
        if not title or title == config.title:
            return False

        next_config = config.model_copy(update={"title": title})
        resp = await self._client.put(
            f"/sessions/{session_id}/config",
            json=next_config.model_dump(exclude_none=True),
        )
        resp.raise_for_status()
        self._configs[session_id] = next_config
        return True

    async def get_messages(self, session_id: str) -> list[ChatMessage]:
        resp = await self._client.get(f"/sessions/{session_id}/messages")
        resp.raise_for_status()
        return [ChatMessage.model_validate(item) for item in resp.json()]

    async def delete_session(self, session_id: str) -> None:
        resp = await self._client.delete(f"/sessions/{session_id}")
        resp.raise_for_status()
        await self._client.delete(f"/sessions/{session_id}/config")
        self._configs.pop(session_id, None)

    async def delete_messages(
        self,
        session_id: str,
        indices: list[int],
    ) -> SessionMessageDeleteResponse:
        detail = await self.get_session(session_id)
        if detail.status in {"running", "interrupted"}:
            raise RuntimeError("当前会话正在处理中，暂时不能删除消息")

        normalized_indices = sorted(set(indices))
        if not normalized_indices:
            return SessionMessageDeleteResponse(
                session_id=session_id,
                deleted_count=0,
                message_count=detail.message_count,
                updated_at=detail.updated_at,
            )

        messages = await self.get_messages(session_id)
        max_index = len(messages) - 1
        if any(index < 0 or index > max_index for index in normalized_indices):
            raise IndexError("消息索引超出范围")

        delete_positions = set(normalized_indices)
        remaining_messages = [
            message.model_dump(exclude_none=True)
            for idx, message in enumerate(messages)
            if idx not in delete_positions
        ]
        config = await self._ensure_session_config(session_id) or SessionCreateRequest()
        telemetry = load_hitl_session_telemetry(session_id)

        delete_resp = await self._client.delete(f"/sessions/{session_id}")
        delete_resp.raise_for_status()

        create_resp = await self._client.put(
            f"/sessions/{session_id}",
            json={"state": remaining_messages},
        )
        create_resp.raise_for_status()
        config_resp = await self._client.put(
            f"/sessions/{session_id}/config",
            json=config.model_dump(exclude_none=True),
        )
        config_resp.raise_for_status()
        self._configs[session_id] = config

        if telemetry is not None:
            save_hitl_session_telemetry(
                telemetry.model_copy(
                    update={
                        "updated_at": _now_iso(),
                    }
                )
            )

        refreshed_detail = await self.get_session(session_id)
        return SessionMessageDeleteResponse(
            session_id=session_id,
            deleted_count=len(delete_positions),
            message_count=refreshed_detail.message_count,
            updated_at=refreshed_detail.updated_at,
        )

    async def _ensure_session_config(self, session_id: str) -> SessionCreateRequest | None:
        cached = self._configs.get(session_id)
        if cached is not None:
            return cached

        resp = await self._client.get(f"/sessions/{session_id}/config")
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        config = SessionCreateRequest.model_validate(resp.json())
        self._configs[session_id] = config
        return config

    async def _load_runtime_summaries(self) -> list[SessionSummary] | None:
        resp = await self._client.get("/backend/sessions")
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return [SessionSummary.model_validate(item) for item in resp.json()]

    async def _load_runtime_detail(self, session_id: str) -> SessionDetail | None:
        resp = await self._client.get(f"/backend/sessions/{session_id}")
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return SessionDetail.model_validate(resp.json())

    async def _load_runtime_turn_metrics(self, session_id: str) -> TurnMetrics | None:
        resp = await self._client.get(f"/backend/sessions/{session_id}/turn-metrics")
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        payload = resp.json()
        if payload is None:
            return None
        return TurnMetrics.model_validate(payload)

    def _config_from_detail(self, detail: SessionDetail) -> SessionCreateRequest:
        return SessionCreateRequest(
            title=detail.title,
            system_prompt=detail.system_prompt,
            provider=detail.provider,
            model_name=detail.model_name,
            model_client=detail.model_client,
            pricing_model=detail.pricing_model,
            cache_policy=detail.cache_policy,
            max_steps=detail.max_steps,
            timeout_seconds=detail.timeout_seconds,
            thinking=detail.thinking,
            enabled_tools=list(detail.enabled_tools),
            mcp_servers=list(detail.mcp_servers),
            multi_agent=detail.multi_agent,
            sandbox=detail.sandbox,
            human_in_the_loop=detail.human_in_the_loop,
            approval_tool_names=list(detail.approval_tool_names),
            input_guardrails=list(detail.input_guardrails),
            output_guardrails=list(detail.output_guardrails),
            tool_guardrails=list(detail.tool_guardrails),
            response_format=detail.response_format,
            memory=detail.memory,
        )

    async def run_turn(
        self,
        session_id: str,
        content: str,
        event_queue: asyncio.Queue | None = None,
        uploads: list[UploadFile] | None = None,
    ) -> MessageResponse:
        return await self.run_turn_message(
            session_id,
            {"content": content},
            event_queue=event_queue,
            uploads=uploads,
        )

    async def run_turn_message(
        self,
        session_id: str,
        message_payload: dict[str, Any],
        event_queue: asyncio.Queue | None = None,
        uploads: list[UploadFile] | None = None,
    ) -> MessageResponse:
        prepared_payload = await self._prepare_message_payload(session_id, message_payload, uploads=uploads)
        await self.dispatch_turn_message(session_id, prepared_payload)
        if event_queue is not None:
            display_content = prepared_payload.get("content")
            user_params = prepared_payload.get("user_params")
            if isinstance(user_params, dict) and isinstance(user_params.get("display_content"), str):
                display_content = user_params.get("display_content")
            await event_queue.put(
                {
                    "event": "session.started",
                    "data": {
                        "session_id": session_id,
                        "content": display_content if isinstance(display_content, str) else "",
                        "timestamp": _now_iso(),
                    },
                }
            )
        return await self._poll_until_pause_or_done(session_id, event_queue=event_queue)

    async def dispatch_turn_message(
        self,
        session_id: str,
        message_payload: dict[str, Any],
        *,
        uploads: list[UploadFile] | None = None,
    ) -> MessageResponse:
        prepared_payload = await self._prepare_message_payload(session_id, message_payload, uploads=uploads)
        resp = await self._client.post(f"/sessions/{session_id}/messages", json=prepared_payload)
        resp.raise_for_status()
        return MessageResponse(
            session_id=session_id,
            status="running",
        )

    async def resolve_interrupt(
        self,
        session_id: str,
        request: InterruptResumeRequest,
        event_queue: asyncio.Queue | None = None,
    ) -> MessageResponse:
        resp = await self._client.post(
            f"/sessions/{session_id}/resume",
            json=request.model_dump(exclude_none=True),
        )
        resp.raise_for_status()
        if event_queue is not None:
            await event_queue.put(
                {
                    "event": "session.resumed",
                    "data": {"session_id": session_id, "timestamp": _now_iso()},
                }
            )
        return await self._poll_until_pause_or_done(session_id, event_queue=event_queue)

    async def _poll_until_pause_or_done(
        self,
        session_id: str,
        *,
        event_queue: asyncio.Queue | None,
    ) -> MessageResponse:
        last_telemetry_signature: str | None = None
        while True:
            detail = await self.get_session(session_id)
            turn_metrics = await self._load_runtime_turn_metrics(session_id)
            if detail.status == "running" and event_queue is not None:
                next_signature = _metrics_signature(turn_metrics)
                if next_signature is not None and next_signature != last_telemetry_signature:
                    await event_queue.put(
                        {
                            "event": "session.telemetry",
                            "data": {
                                "session_id": session_id,
                                "metrics": turn_metrics.model_dump(exclude_none=True),
                                "timestamp": _now_iso(),
                            },
                        }
                    )
                    last_telemetry_signature = next_signature
            if detail.status == "running":
                await asyncio.sleep(0.15)
                continue

            if detail.status == "interrupted":
                if event_queue is not None and detail.interrupts:
                    await event_queue.put(
                        {
                            "event": "session.interrupted",
                            "data": {
                                "session_id": session_id,
                                "interrupt": detail.interrupts[0].model_dump(),
                                "interrupts": [
                                    item.model_dump(exclude_none=True) for item in detail.interrupts
                                ],
                                "metrics": turn_metrics.model_dump(exclude_none=True) if turn_metrics else None,
                                "timestamp": _now_iso(),
                            },
                        }
                    )
                return MessageResponse(
                    session_id=session_id,
                    assistant=None,
                    metrics=turn_metrics,
                    status="interrupted",
                    interrupts=detail.interrupts,
                )

            if detail.status == "idle":
                if event_queue is not None and detail.last_response:
                    await event_queue.put(
                        {
                            "event": "assistant.final",
                            "data": {
                                "session_id": session_id,
                                "assistant": detail.last_response.model_dump(exclude_none=True),
                                "metrics": (
                                    turn_metrics.model_dump(exclude_none=True)
                                    if turn_metrics
                                    else None
                                ),
                                "timestamp": _now_iso(),
                            },
                        }
                    )
                return MessageResponse(
                    session_id=session_id,
                    assistant=detail.last_response,
                    metrics=turn_metrics,
                    status="idle",
                )

            return MessageResponse(
                session_id=session_id,
                assistant=None,
                metrics=turn_metrics,
                status="error",
                error=detail.last_error,
            )

    async def _prepare_message_payload(
        self,
        session_id: str,
        message_payload: dict[str, Any],
        *,
        uploads: list[UploadFile] | None = None,
    ) -> dict[str, Any]:
        payload = dict(message_payload)
        payload.setdefault("role", "user")

        if not uploads:
            return payload

        original_content = payload.get("content")
        normalized_content = original_content if isinstance(original_content, str) else ""
        attachments = await self._save_attachments(session_id, uploads)
        prompt_content, attachment_user_params = self._build_user_prompt_with_attachments(
            content=normalized_content,
            attachments=attachments,
        )
        payload["content"] = prompt_content
        existing_user_params = payload.get("user_params")
        merged_user_params = (
            dict(existing_user_params)
            if isinstance(existing_user_params, dict)
            else {}
        )
        if attachment_user_params:
            merged_user_params.update(attachment_user_params)
        if merged_user_params:
            payload["user_params"] = merged_user_params
        return payload

    async def _save_attachments(
        self,
        session_id: str,
        uploads: list[UploadFile],
    ) -> list[dict[str, Any]]:
        if not uploads:
            return []

        attachment_dir = get_session_upload_dir(session_id)
        attachment_dir.mkdir(parents=True, exist_ok=True)
        descriptors: list[dict[str, Any]] = []
        timestamp_prefix = int(time.time())

        for index, upload in enumerate(uploads, start=1):
            raw_bytes = await upload.read()
            await upload.close()
            if not raw_bytes:
                continue

            safe_name = sanitize_upload_filename(upload.filename)
            stored_name = f"{timestamp_prefix}-{index:02d}-{uuid.uuid4().hex[:8]}-{safe_name}"
            file_path = attachment_dir / stored_name
            file_path.write_bytes(raw_bytes)

            mime_type = upload.content_type or "application/octet-stream"
            is_image = mime_type.startswith("image/")
            descriptor = {
                "id": uuid.uuid4().hex[:10],
                "kind": "image" if is_image else "file",
                "file_name": safe_name,
                "mime_type": mime_type,
                "size_bytes": len(raw_bytes),
                "size_label": format_bytes(len(raw_bytes)),
                "file_path": str(file_path),
            }
            if is_image:
                descriptor["base64_data"] = base64.b64encode(raw_bytes).decode("ascii")
            descriptors.append(descriptor)

        return descriptors

    def _build_user_prompt_with_attachments(
        self,
        *,
        content: str,
        attachments: list[dict[str, Any]],
    ) -> tuple[str, dict[str, Any] | None]:
        normalized_content = content.strip()
        if not attachments:
            return normalized_content, None

        display_content = normalized_content or f"已上传 {len(attachments)} 个附件"
        prompt_lines: list[str] = []
        visible_attachments: list[dict[str, Any]] = []
        image_payloads: list[dict[str, Any]] = []

        for index, attachment in enumerate(attachments, start=1):
            visible_attachment = {
                key: value
                for key, value in attachment.items()
                if key != "base64_data"
            }
            visible_attachments.append(visible_attachment)
            if attachment.get("kind") == "image":
                image_payloads.append(
                    {
                        "file_name": attachment.get("file_name"),
                        "mime_type": attachment.get("mime_type"),
                        "base64_data": attachment.get("base64_data"),
                    }
                )
            prompt_lines.append(
                f"{index}. [{attachment.get('kind')}] "
                f"{attachment.get('file_name')} "
                f"({attachment.get('mime_type')}, {attachment.get('size_label')})\n"
                f"   已保存到: {attachment.get('file_path')}"
            )

        prompt_content = normalized_content or "请查看我上传的附件，并结合附件内容继续处理。"
        prompt = (
            f"{prompt_content}\n\n"
            "以下是本轮附带的附件，必要时你可以直接使用其中的绝对路径继续调用工具：\n"
            f"{chr(10).join(prompt_lines)}"
        )
        user_params: dict[str, Any] = {
            "attachments": visible_attachments,
            "display_content": display_content,
        }
        if image_payloads:
            user_params["images"] = image_payloads
        return prompt, user_params

    async def list_workflows(self) -> list[WorkflowDefinitionSummary]:
        return self._workflow_service.list_definitions()

    async def plan_workflow_run(self, request: WorkflowPlannerRequest) -> WorkflowPlannerResponse:
        return await self._workflow_service.plan_run(request)

    async def start_agent_workflow_run(self, request: WorkflowPlannerRequest) -> WorkflowRunDetail:
        return await self._workflow_service.start_agent_run(request)

    async def list_workflow_runs(self) -> list[WorkflowRunSummary]:
        return self._workflow_service.list_runs()

    async def start_workflow_run(self, request: WorkflowRunRequest) -> WorkflowRunDetail:
        return await self._workflow_service.start_run(request)

    async def get_workflow_run(self, run_id: str) -> WorkflowRunDetail:
        return self._workflow_service.get_run(run_id)

    async def cancel_workflow_run(
        self,
        run_id: str,
        request: WorkflowRunControlRequest | None = None,
    ) -> WorkflowRunDetail:
        return self._workflow_service.cancel_run(run_id, request=request)

    async def terminate_workflow_run(
        self,
        run_id: str,
        request: WorkflowRunControlRequest | None = None,
    ) -> WorkflowRunDetail:
        return self._workflow_service.terminate_run(run_id, request=request)

    async def get_tool_catalog(self) -> ToolCatalogResponse:
        return get_tool_catalog_response()

    async def get_workflow_catalog(self) -> WorkflowCatalogResponse:
        return get_workflow_catalog()

    async def get_tracing_status(self) -> TracingStatus:
        return self._tracing_service.status()

    async def export_trace(self) -> TraceExportResult:
        return self._tracing_service.export()

    async def get_session_tracing_status(self, session_id: str) -> TracingStatus:
        await self.get_session(session_id)
        return self._tracing_service.status(session_id=session_id)

    async def export_session_trace(self, session_id: str) -> TraceExportResult:
        await self.get_session(session_id)
        return self._tracing_service.export(session_id=session_id)

    async def get_workflow_tracing_status(self, run_id: str) -> TracingStatus:
        self._workflow_service.get_run(run_id)
        return self._tracing_service.status(workflow_run_id=run_id)

    async def export_workflow_trace(self, run_id: str) -> TraceExportResult:
        self._workflow_service.get_run(run_id)
        return self._tracing_service.export(workflow_run_id=run_id)
