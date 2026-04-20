from __future__ import annotations

import asyncio
import json
import time
from copy import deepcopy
from typing import Any

from fastapi import UploadFile
from motus.models import ChatMessage

from core.schemas.session import ChatTurnResult, TurnMetrics
from core.visualization import DatasetProfile, VisualizationPolicyDecision
from core.tracing import session_trace_scope
from .utils import utc_now_iso


class ChatSessionTurnMixin:
    def _normalize_content_value(self, content: Any) -> tuple[str, dict[str, Any] | None]:
        """把统一消息 content 收敛为本地 agent 可处理的字符串。"""

        if isinstance(content, str):
            return content, None
        if content in (None, ""):
            return "", None
        return (
            json.dumps(content, ensure_ascii=False, indent=2),
            {
                "raw_content": content,
                "raw_content_type": type(content).__name__,
            },
        )

    def _normalize_message_payload(self, message_payload: dict[str, Any]) -> dict[str, Any]:
        """把统一消息请求体规范化为本地运行时可消费的形状。"""

        role = str(message_payload.get("role") or "user")
        if role != "user":
            raise RuntimeError("当前统一会话消息入口仅支持 user role")

        normalized_content, extra_user_params = self._normalize_content_value(message_payload.get("content"))
        merged_user_params = (
            dict(message_payload.get("user_params"))
            if isinstance(message_payload.get("user_params"), dict)
            else {}
        )
        if extra_user_params:
            merged_user_params.update(extra_user_params)

        base64_image = message_payload.get("base64_image")
        normalized_base64_image = base64_image.strip() if isinstance(base64_image, str) and base64_image.strip() else None
        webhook = message_payload.get("webhook") if isinstance(message_payload.get("webhook"), dict) else None

        display_content = merged_user_params.get("display_content")
        if not isinstance(display_content, str) or not display_content.strip():
            if normalized_content.strip():
                display_content = normalized_content.strip()
            elif normalized_base64_image:
                display_content = "已发送图片"
            else:
                display_content = "已发送消息"

        return {
            "role": role,
            "content": normalized_content,
            "user_params": merged_user_params or None,
            "base64_image": normalized_base64_image,
            "webhook": webhook,
            "display_content": display_content,
        }

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
        prompt_lines = []
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

    def _build_visualization_guidance(
        self,
        *,
        content: str,
        attachments: list[dict[str, Any]],
        dataset_profiles: list[DatasetProfile],
    ) -> tuple[VisualizationPolicyDecision, str | None]:
        decision = self.visualization_policy_service.decide(
            content=content,
            attachments=attachments,
            dataset_profiles=dataset_profiles,
            enabled_tools=self.config.enabled_tools,
        )
        dataset_context = self.data_analysis_service.build_prompt_context(dataset_profiles)
        return decision, dataset_context

    def _augment_prompt_for_visualization(
        self,
        *,
        original_content: str,
        prompt_content: str,
        user_params: dict[str, Any] | None,
        decision: VisualizationPolicyDecision,
        dataset_context: str | None,
    ) -> tuple[str, dict[str, Any] | None]:
        if not decision.has_instructions() and not dataset_context:
            return prompt_content, user_params

        instruction_lines = ["[系统补充指引，仅对本轮生效]"]
        instruction_lines.extend(f"- {line}" for line in decision.instructions)
        if decision.preferred_visuals:
            instruction_lines.append(f"- 推荐优先图型：{', '.join(decision.preferred_visuals)}")
        if dataset_context:
            instruction_lines.append(dataset_context)

        augmented_prompt = f"{prompt_content}\n\n" + "\n".join(instruction_lines)
        merged_user_params = dict(user_params or {})
        if original_content.strip():
            merged_user_params.setdefault("display_content", original_content.strip())
        return augmented_prompt, merged_user_params or None

    def _apply_assistant_message_update(self, assistant: ChatMessage, content: str) -> ChatMessage:
        assistant.content = content
        memory_messages = self._memory_messages()
        for message in reversed(memory_messages):
            if message.role == "assistant":
                message.content = content
                break
        return assistant

    async def _post_process_assistant_response(
        self,
        *,
        user_content: str,
        assistant: ChatMessage,
        decision: VisualizationPolicyDecision,
        dataset_context: str | None,
    ) -> ChatMessage:
        if self.config.response_format.enabled():
            return assistant
        if not isinstance(assistant.content, str):
            return assistant

        enhanced = await self.visualization_rewrite_service.maybe_rewrite(
            user_content=user_content,
            assistant_content=assistant.content,
            decision=decision,
            dataset_context=dataset_context,
        )
        return self._apply_assistant_message_update(assistant, enhanced)

    def _strip_binary_payloads_from_history(self) -> None:
        """在当前轮结束后移除历史中的 base64 负载，避免后续轮次重复传图。"""

        changed = False
        for message in self._memory_messages():
            if getattr(message, "base64_image", None):
                message.base64_image = None
                changed = True
            if not isinstance(message.user_params, dict):
                continue
            image_items = message.user_params.get("images")
            if not isinstance(image_items, list):
                continue
            for image_item in image_items:
                if isinstance(image_item, dict) and image_item.pop("base64_data", None) is not None:
                    changed = True
        if changed:
            self._rewrite_conversation_log(self.history())

    async def ask(
        self,
        content: str,
        event_queue: asyncio.Queue[dict[str, Any]] | None = None,
        uploads: list[UploadFile] | None = None,
    ) -> ChatTurnResult:
        return await self.ask_message(
            {"content": content},
            event_queue=event_queue,
            uploads=uploads,
        )

    async def ask_message(
        self,
        message_payload: dict[str, Any],
        event_queue: asyncio.Queue[dict[str, Any]] | None = None,
        uploads: list[UploadFile] | None = None,
    ) -> ChatTurnResult:
        normalized_payload = self._normalize_message_payload(message_payload)
        if normalized_payload["webhook"] is not None:
            raise RuntimeError("本地 backend 暂不支持 webhook 派发，请切换到 HITL backend")

        self._reconcile_runtime_state()
        if self._lock.locked():
            raise RuntimeError("当前会话正在处理上一条消息")

        async with self._lock:
            self.status = "running"
            self.last_error = None
            self.updated_at = utc_now_iso()
            self._event_queue = event_queue
            self._active_turn_task = asyncio.current_task()
            self._turn_started_monotonic = time.monotonic()
            self._mark_turn_activity()
            self.persist()

            if event_queue is not None:
                await event_queue.put(
                    {
                        "event": "session.started",
                        "data": {
                            "session_id": self.session_id,
                            "content": normalized_payload["display_content"],
                            "timestamp": utc_now_iso(),
                        },
                    }
                )

            root_usage_before = deepcopy(self.agent.usage)
            specialist_before = self.specialist_usage_tracker.snapshot()
            usage_before = self.aggregate_usage()
            self._turn_usage_baseline = deepcopy(usage_before)
            self._session_cost_baseline_usd = self.aggregate_total_cost()
            attachments = await self._save_attachments(uploads or [])
            try:
                content = normalized_payload["content"]
                existing_user_params = (
                    dict(normalized_payload["user_params"])
                    if isinstance(normalized_payload["user_params"], dict)
                    else {}
                )
                prompt_content, user_params = self._build_user_prompt_with_attachments(
                    content=content,
                    attachments=attachments,
                )
                merged_user_params = dict(existing_user_params)
                if user_params:
                    merged_user_params.update(user_params)
                user_params = merged_user_params or None
                dataset_profiles = self.data_analysis_service.inspect_attachments(attachments)
                decision, dataset_context = self._build_visualization_guidance(
                    content=str(normalized_payload["display_content"]),
                    attachments=attachments,
                    dataset_profiles=dataset_profiles,
                )
                prompt_content, user_params = self._augment_prompt_for_visualization(
                    original_content=str(normalized_payload["display_content"]),
                    prompt_content=prompt_content,
                    user_params=user_params,
                    decision=decision,
                    dataset_context=dataset_context,
                )
                with session_trace_scope(self.session_id):
                    if user_params or normalized_payload["base64_image"]:
                        await self.agent.add_message(
                            ChatMessage(
                                role="user",
                                content=prompt_content,
                                user_params=user_params,
                                base64_image=normalized_payload["base64_image"],
                            )
                        )
                        response_text = await self.agent(None)
                    else:
                        response_text = await self.agent(prompt_content)
                assistant = self.agent.get_last_assistant_message()
                if assistant is None:
                    assistant = ChatMessage.assistant_message(content=response_text)
                assistant = await self._post_process_assistant_response(
                    user_content=str(normalized_payload["display_content"]),
                    assistant=assistant,
                    decision=decision,
                    dataset_context=dataset_context,
                )
                await self.ensure_title()

                root_usage_after = deepcopy(self.agent.usage)
                specialist_after = self.specialist_usage_tracker.snapshot()
                usage_after = self.aggregate_usage()
                turn_usage = self._calculate_turn_usage(usage_before, usage_after)
                agent_metrics = self.build_agent_metrics(
                    root_usage_before=root_usage_before,
                    root_usage_after=root_usage_after,
                    specialist_before=specialist_before,
                    specialist_after=specialist_after,
                )
                metrics = TurnMetrics(
                    turn_usage=turn_usage,
                    session_usage=usage_after,
                    turn_cost_usd=self.aggregate_turn_cost(agent_metrics),
                    session_cost_usd=self.aggregate_total_cost(),
                    context_window=self.agent.context_window_usage,
                    agent_metrics=agent_metrics,
                )
                self.last_response = assistant
                self.status = "idle"
                self.last_error = None
                self._strip_binary_payloads_from_history()
                self._rewrite_conversation_log(self.history())
                self.updated_at = utc_now_iso()
                self.persist()

                if event_queue is not None:
                    await event_queue.put(
                        {
                            "event": "assistant.final",
                            "data": {
                                "session_id": self.session_id,
                                "assistant": assistant.model_dump(exclude_none=True),
                                "metrics": metrics.model_dump(exclude_none=True),
                                "timestamp": utc_now_iso(),
                            },
                        }
                    )

                return ChatTurnResult(assistant=assistant, metrics=metrics)
            except asyncio.CancelledError:
                self.status = "error"
                if not self.last_error:
                    timeout_limit = int(self.config.timeout_seconds or 600)
                    self.last_error = f"会话执行超过 {timeout_limit}s 未完成，任务已取消"
                self._strip_binary_payloads_from_history()
                self.updated_at = utc_now_iso()
                self.persist()
                if event_queue is not None:
                    await event_queue.put(
                        {
                            "event": "session.error",
                            "data": {
                                "session_id": self.session_id,
                                "message": self.last_error,
                                "timestamp": utc_now_iso(),
                            },
                        }
                    )
                raise RuntimeError(self.last_error) from None
            except Exception as exc:
                self.status = "error"
                self.last_error = str(exc)
                self._strip_binary_payloads_from_history()
                self.updated_at = utc_now_iso()
                self.persist()
                if event_queue is not None:
                    await event_queue.put(
                        {
                            "event": "session.error",
                            "data": {
                                "session_id": self.session_id,
                                "message": self.last_error,
                                "timestamp": utc_now_iso(),
                            },
                        }
                    )
                raise
            finally:
                if self.status == "running":
                    self.status = "error" if self.last_error else "idle"
                self._event_queue = None
                self._turn_usage_baseline = {}
                self._session_cost_baseline_usd = None
                self._active_turn_task = None
                self._turn_started_monotonic = None
                self._last_activity_monotonic = None

    def _calculate_turn_usage(
        self,
        usage_before: dict[str, Any],
        usage_after: dict[str, Any],
    ) -> dict[str, Any]:
        from core.llm.costs import diff_usage

        return diff_usage(usage_before, usage_after)
