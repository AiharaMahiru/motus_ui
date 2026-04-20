from __future__ import annotations

import asyncio
import json
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request, Response, UploadFile
from fastapi.responses import StreamingResponse
from motus.models import ChatMessage

from core.chat import format_sse, utc_now_iso
from core.schemas.session import (
    InterruptResumeRequest,
    MessageRequest,
    MessageResponse,
    SessionCreateRequest,
    SessionDetail,
    SessionMessageDeleteRequest,
    SessionMessageDeleteResponse,
    SessionSummary,
    SessionUpdateRequest,
)
from core.schemas.tracing import TraceExportResult, TracingStatus
from core.servers.api_context import ApiServices


def _has_message_content(payload: dict[str, Any], uploads: list[UploadFile]) -> bool:
    if uploads:
        return True

    content = payload.get("content")
    if isinstance(content, str):
        if content.strip():
            return True
    elif content not in (None, "", []):
        return True

    base64_image = payload.get("base64_image")
    if isinstance(base64_image, str) and base64_image.strip():
        return True

    user_params = payload.get("user_params")
    if isinstance(user_params, dict) and user_params:
        return True

    return False


async def _parse_message_request(request: Request) -> tuple[dict[str, Any], list[UploadFile]]:
    """统一解析普通 JSON 与 multipart 消息请求。"""

    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        form = await request.form()
        raw_content = form.get("content", "")
        content = raw_content if isinstance(raw_content, str) else ""
        uploads = [
            item
            for item in form.getlist("files")
            if isinstance(item, UploadFile) or (hasattr(item, "filename") and hasattr(item, "read"))
        ]
        payload: dict[str, Any] = {
            "role": str(form.get("role") or "user"),
            "content": content,
        }
        raw_user_params = form.get("user_params")
        if isinstance(raw_user_params, str) and raw_user_params.strip():
            try:
                parsed_user_params = json.loads(raw_user_params)
                if isinstance(parsed_user_params, dict):
                    payload["user_params"] = parsed_user_params
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="multipart 的 user_params 必须是 JSON 对象字符串")
        raw_base64_image = form.get("base64_image")
        if isinstance(raw_base64_image, str) and raw_base64_image.strip():
            payload["base64_image"] = raw_base64_image.strip()
        if not _has_message_content(payload, uploads):
            raise HTTPException(status_code=400, detail="消息内容和附件不能同时为空")
        return payload, uploads

    payload = MessageRequest.model_validate(await request.json()).model_dump(exclude_none=True)
    if not _has_message_content(payload, []):
        raise HTTPException(status_code=400, detail="消息内容不能为空")
    return payload, []


def _raise_backend_error(exc: Exception) -> None:
    """把 backend 抛出的通用异常映射为稳定的 HTTP 响应。"""

    if isinstance(exc, KeyError):
        raise HTTPException(status_code=404, detail="会话不存在")
    if isinstance(exc, RuntimeError):
        raise HTTPException(status_code=409, detail=str(exc))
    if isinstance(exc, httpx.HTTPStatusError):
        detail = ""
        try:
            payload = exc.response.json()
            if isinstance(payload, dict):
                detail = str(payload.get("detail") or "")
        except Exception:
            detail = ""
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=detail or str(exc),
        )
    if isinstance(exc, httpx.HTTPError):
        raise HTTPException(status_code=502, detail=f"HITL backend 不可用: {exc}")
    raise exc


async def _build_streaming_response(
    *,
    runner,
    session_id: str,
) -> StreamingResponse:
    async def event_stream():
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        task = asyncio.create_task(runner(queue))
        try:
            while True:
                if task.done() and queue.empty():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=0.5)
                except asyncio.TimeoutError:
                    continue
                yield format_sse(event["event"], event["data"])

            await task
        except Exception as exc:
            yield format_sse(
                "session.error",
                {
                    "session_id": session_id,
                    "message": str(exc),
                    "timestamp": utc_now_iso(),
                },
            )
        finally:
            yield format_sse(
                "done",
                {"session_id": session_id, "timestamp": utc_now_iso()},
            )

    return StreamingResponse(event_stream(), media_type="text/event-stream")


async def _maybe_backfill_session_titles(services: ApiServices, *, limit: int) -> None:
    backfill = getattr(services.session_backend, "backfill_missing_titles", None)
    if callable(backfill):
        await backfill(limit=limit)
        return
    if services.chat_service is not None:
        await services.chat_service.backfill_missing_titles(limit=limit)


async def _run_message_request(
    services: ApiServices,
    *,
    session_id: str,
    payload: dict[str, Any],
    uploads: list[UploadFile],
    event_queue: asyncio.Queue[dict[str, Any]] | None = None,
) -> MessageResponse:
    run_turn_message = getattr(services.session_backend, "run_turn_message", None)
    if callable(run_turn_message):
        return await run_turn_message(
            session_id,
            payload,
            event_queue=event_queue,
            uploads=uploads,
        )

    extra_keys = {key for key in payload if key not in {"role", "content"}}
    if extra_keys:
        raise RuntimeError(f"当前 backend 暂不支持扩展消息字段: {', '.join(sorted(extra_keys))}")

    content = payload.get("content")
    if not isinstance(content, str):
        raise RuntimeError("当前 backend 仅支持字符串 content；请切换到 HITL backend 使用扩展消息能力")
    return await services.session_backend.run_turn(
        session_id,
        content,
        event_queue=event_queue,
        uploads=uploads,
    )


async def _dispatch_message_request(
    services: ApiServices,
    *,
    session_id: str,
    payload: dict[str, Any],
    uploads: list[UploadFile],
) -> MessageResponse:
    dispatch_turn_message = getattr(services.session_backend, "dispatch_turn_message", None)
    if callable(dispatch_turn_message):
        return await dispatch_turn_message(session_id, payload, uploads=uploads)

    dispatch_turn = getattr(services.session_backend, "dispatch_turn", None)
    content = payload.get("content")
    extra_keys = {key for key in payload if key not in {"role", "content"}}
    if callable(dispatch_turn) and isinstance(content, str) and not extra_keys:
        return await dispatch_turn(session_id, content, uploads=uploads)

    raise RuntimeError("当前 backend 尚未支持异步 202 消息派发，请使用 stream 路由或 wait=true 同步等待")


def create_session_router(services: ApiServices) -> APIRouter:
    router = APIRouter()

    @router.post("/api/sessions", response_model=SessionDetail)
    async def create_session(request: SessionCreateRequest) -> SessionDetail:
        try:
            return await services.session_backend.create_session(request)
        except Exception as exc:
            _raise_backend_error(exc)

    @router.get("/api/sessions", response_model=list[SessionSummary])
    async def list_sessions() -> list[SessionSummary]:
        await _maybe_backfill_session_titles(services, limit=3)
        try:
            return await services.session_backend.list_sessions()
        except Exception as exc:
            _raise_backend_error(exc)

    @router.get("/api/sessions/{session_id}", response_model=SessionDetail)
    async def get_session(
        session_id: str,
        wait: bool = False,
        timeout: float | None = None,
    ) -> SessionDetail:
        await _maybe_backfill_session_titles(services, limit=1)
        try:
            if wait:
                get_session_wait = getattr(services.session_backend, "get_session_wait", None)
                if callable(get_session_wait):
                    return await get_session_wait(session_id, timeout=timeout)
            return await services.session_backend.get_session(session_id)
        except Exception as exc:
            _raise_backend_error(exc)

    @router.patch("/api/sessions/{session_id}", response_model=SessionDetail)
    async def update_session(session_id: str, request: SessionUpdateRequest) -> SessionDetail:
        try:
            return await services.session_backend.update_session(session_id, request)
        except Exception as exc:
            _raise_backend_error(exc)

    @router.get("/api/sessions/{session_id}/messages", response_model=list[ChatMessage])
    async def get_messages(session_id: str) -> list[ChatMessage]:
        try:
            return await services.session_backend.get_messages(session_id)
        except Exception as exc:
            _raise_backend_error(exc)

    @router.post("/api/sessions/{session_id}/messages/delete", response_model=SessionMessageDeleteResponse)
    async def delete_messages(session_id: str, request: SessionMessageDeleteRequest) -> SessionMessageDeleteResponse:
        try:
            return await services.session_backend.delete_messages(session_id, request.indices)
        except IndexError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        except Exception as exc:
            _raise_backend_error(exc)

    @router.delete("/api/sessions/{session_id}", status_code=204)
    async def delete_session(session_id: str) -> None:
        try:
            await services.session_backend.delete_session(session_id)
        except Exception as exc:
            _raise_backend_error(exc)

    @router.get("/api/sessions/{session_id}/tracing", response_model=TracingStatus)
    async def get_session_tracing_status(session_id: str) -> TracingStatus:
        try:
            return await services.session_backend.get_session_tracing_status(session_id)
        except Exception as exc:
            _raise_backend_error(exc)

    @router.post("/api/sessions/{session_id}/tracing/export", response_model=TraceExportResult)
    async def export_session_trace(session_id: str) -> TraceExportResult:
        try:
            return await services.session_backend.export_session_trace(session_id)
        except Exception as exc:
            _raise_backend_error(exc)

    @router.post("/api/sessions/{session_id}/messages", response_model=MessageResponse)
    async def send_message(
        session_id: str,
        request: Request,
        response: Response,
        wait: bool = True,
    ) -> MessageResponse:
        payload, uploads = await _parse_message_request(request)

        try:
            if wait:
                return await _run_message_request(
                    services,
                    session_id=session_id,
                    payload=payload,
                    uploads=uploads,
                )
            response.status_code = 202
            return await _dispatch_message_request(
                services,
                session_id=session_id,
                payload=payload,
                uploads=uploads,
            )
        except Exception as exc:
            _raise_backend_error(exc)

    @router.post("/api/sessions/{session_id}/messages/stream")
    async def stream_message(session_id: str, request: Request) -> StreamingResponse:
        try:
            detail = await services.session_backend.get_session(session_id)
        except Exception as exc:
            _raise_backend_error(exc)
        if detail.status in {"running", "interrupted"}:
            raise HTTPException(status_code=409, detail=f"当前会话状态为 {detail.status}，暂时不能发送新消息")

        payload, uploads = await _parse_message_request(request)

        return await _build_streaming_response(
            runner=lambda queue: _run_message_request(
                services,
                session_id=session_id,
                payload=payload,
                uploads=uploads,
                event_queue=queue,
            ),
            session_id=session_id,
        )

    @router.post("/api/sessions/{session_id}/resume", response_model=MessageResponse)
    async def resume_session(session_id: str, request: InterruptResumeRequest) -> MessageResponse:
        try:
            return await services.session_backend.resolve_interrupt(session_id, request)
        except Exception as exc:
            _raise_backend_error(exc)

    @router.post("/api/sessions/{session_id}/resume/stream")
    async def stream_resume_session(session_id: str, request: InterruptResumeRequest) -> StreamingResponse:
        try:
            detail = await services.session_backend.get_session(session_id)
        except Exception as exc:
            _raise_backend_error(exc)
        if detail.status != "interrupted":
            raise HTTPException(status_code=409, detail=f"当前会话状态为 {detail.status}，无需 resume")

        return await _build_streaming_response(
            runner=lambda queue: services.session_backend.resolve_interrupt(
                session_id,
                request,
                event_queue=queue,
            ),
            session_id=session_id,
        )

    return router
