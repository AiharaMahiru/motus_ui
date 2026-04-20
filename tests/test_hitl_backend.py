import shutil
import unittest
from unittest.mock import AsyncMock, patch
from io import BytesIO

import httpx
import asyncio
from motus.models import ChatMessage
from starlette.datastructures import Headers, UploadFile

from core.agents.hitl_agent import default_hitl_session_config
from core.backends.hitl import HitlSessionBackend
from core.config.paths import HITL_SESSIONS_DIR
from core.chat.utils import get_session_upload_dir
from core.schemas.session import InterruptInfo, SessionDetail, TurnMetrics
from core.servers.hitl import create_hitl_app


class HitlSessionBackendTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.app = create_hitl_app()
        self.backend = HitlSessionBackend("http://testserver")
        await self.backend._client.aclose()
        self.backend._client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self.app),
            base_url="http://testserver",
            timeout=15.0,
        )
        self._session_ids: list[str] = []

    async def asyncTearDown(self) -> None:
        await self.backend.aclose()
        for session_id in self._session_ids:
            shutil.rmtree(HITL_SESSIONS_DIR / session_id, ignore_errors=True)
            shutil.rmtree(get_session_upload_dir(session_id), ignore_errors=True)

    async def test_backend_prefers_runtime_contract_for_summary_and_detail(self) -> None:
        config = default_hitl_session_config().model_copy(update={"title": "后端适配测试"})
        config.enabled_tools = ["read_file", "bash"]

        detail = await self.backend.create_session(config)
        self._session_ids.append(detail.session_id)

        self.assertEqual(detail.title, "后端适配测试")
        self.assertEqual(detail.model_name, config.model_name)
        self.assertNotEqual(detail.created_at, "n/a")
        self.assertNotEqual(detail.updated_at, "n/a")
        self.assertEqual(detail.enabled_tools, ["read_file", "bash"])

        summaries = await self.backend.list_sessions()
        summary = next(item for item in summaries if item.session_id == detail.session_id)
        self.assertEqual(summary.session_id, detail.session_id)
        self.assertEqual(summary.title, "后端适配测试")
        self.assertNotEqual(summary.created_at, "n/a")
        self.assertNotEqual(summary.updated_at, "n/a")
        self.assertEqual(summary.message_count, 0)

    async def test_backfill_missing_titles_updates_hitl_session_config(self) -> None:
        session_id = "00000000-0000-0000-0000-000000000111"
        self._session_ids.append(session_id)
        created = await self.backend._client.put(
            f"/sessions/{session_id}",
            json={
                "state": [
                    {"role": "user", "content": "帮我整理这周 AI 科学进展"},
                    {"role": "assistant", "content": "好的，我先整理重点方向。"},
                ]
            },
        )
        created.raise_for_status()
        config = default_hitl_session_config().model_copy(update={"title": None})
        config_resp = await self.backend._client.put(
            f"/sessions/{session_id}/config",
            json=config.model_dump(exclude_none=True),
        )
        config_resp.raise_for_status()

        updated = await self.backend.backfill_missing_titles(limit=1)
        detail = await self.backend.get_session(session_id)

        self.assertEqual(updated, 1)
        self.assertIsNotNone(detail.title)
        self.assertNotEqual(detail.title, "")
        self.assertNotEqual(detail.title, f"会话 {session_id[:8]}")

    async def test_prepare_message_payload_turns_uploads_into_attachment_user_params(self) -> None:
        session_id = "00000000-0000-0000-0000-000000000222"
        self._session_ids.append(session_id)
        created = await self.backend._client.put(f"/sessions/{session_id}", json={})
        created.raise_for_status()

        upload = UploadFile(
            file=BytesIO(b"fake-image"),
            filename="diagram.png",
            headers=Headers({"content-type": "image/png"}),
        )
        payload = await self.backend._prepare_message_payload(
            session_id,
            {"content": "请分析这张图"},
            uploads=[upload],
        )

        self.assertIn("以下是本轮附带的附件", payload["content"])
        self.assertEqual(payload["role"], "user")
        self.assertEqual(payload["user_params"]["display_content"], "请分析这张图")
        self.assertEqual(payload["user_params"]["attachments"][0]["file_name"], "diagram.png")
        self.assertEqual(payload["user_params"]["images"][0]["mime_type"], "image/png")

    async def test_delete_messages_recreates_hitl_session_and_preserves_config(self) -> None:
        session_id = "00000000-0000-0000-0000-000000000333"
        self._session_ids.append(session_id)
        created = await self.backend._client.put(
            f"/sessions/{session_id}",
            json={
                "state": [
                    {"role": "user", "content": "第一条"},
                    {"role": "assistant", "content": "第二条"},
                    {"role": "user", "content": "第三条"},
                ]
            },
        )
        created.raise_for_status()
        config = default_hitl_session_config().model_copy(update={"title": "删除消息测试"})
        config_resp = await self.backend._client.put(
            f"/sessions/{session_id}/config",
            json=config.model_dump(exclude_none=True),
        )
        config_resp.raise_for_status()

        response = await self.backend.delete_messages(session_id, [1])
        messages = await self.backend.get_messages(session_id)
        detail = await self.backend.get_session(session_id)

        self.assertEqual(response.deleted_count, 1)
        self.assertEqual(len(messages), 2)
        self.assertEqual(messages[0].content, "第一条")
        self.assertEqual(messages[1].content, "第三条")
        self.assertEqual(detail.title, "删除消息测试")

    async def test_poll_emits_running_session_telemetry_when_metrics_change(self) -> None:
        session_id = "session-1"
        config = default_hitl_session_config().model_copy(update={"title": "telemetry stream"})

        running_detail = SessionDetail(
            session_id=session_id,
            title=config.title,
            status="running",
            provider=config.provider,
            model_name=config.model_name,
            created_at="2026-04-19T00:00:00+00:00",
            updated_at="2026-04-19T00:00:00+00:00",
            message_count=1,
            total_usage={},
            total_cost_usd=None,
            last_error=None,
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
            context_window={"percent": "4%"},
            last_response=None,
            interrupts=None,
            multi_agent_enabled=config.multi_agent.enabled(),
            specialist_count=config.multi_agent.specialist_count(),
        )
        idle_detail = running_detail.model_copy(
            update={
                "status": "idle",
                "last_response": ChatMessage.assistant_message("完成了"),
                "updated_at": "2026-04-19T00:00:03+00:00",
            }
        )
        metrics_first = TurnMetrics(
            turn_usage={"prompt_tokens": 10},
            session_usage={"total_tokens": 10},
            turn_cost_usd=0.001,
            session_cost_usd=0.001,
            context_window={"percent": "2%"},
            agent_metrics=[],
        )
        metrics_second = TurnMetrics(
            turn_usage={"prompt_tokens": 20},
            session_usage={"total_tokens": 20},
            turn_cost_usd=0.002,
            session_cost_usd=0.002,
            context_window={"percent": "4%"},
            agent_metrics=[],
        )
        event_queue: asyncio.Queue = asyncio.Queue()

        with (
            patch.object(
                self.backend,
                "get_session",
                AsyncMock(side_effect=[running_detail, running_detail, idle_detail]),
            ),
            patch.object(
                self.backend,
                "_load_runtime_turn_metrics",
                AsyncMock(side_effect=[metrics_first, metrics_second, metrics_second]),
            ),
            patch("core.backends.hitl.asyncio.sleep", AsyncMock()),
        ):
            result = await self.backend._poll_until_pause_or_done(
                session_id,
                event_queue=event_queue,
            )

        self.assertEqual(result.status, "idle")
        self.assertEqual(result.metrics.session_usage["total_tokens"], 20)

        emitted_events: list[dict] = []
        while not event_queue.empty():
            emitted_events.append(await event_queue.get())

        telemetry_events = [item for item in emitted_events if item["event"] == "session.telemetry"]
        self.assertEqual(len(telemetry_events), 2)
        self.assertEqual(telemetry_events[0]["data"]["metrics"]["session_usage"]["total_tokens"], 10)
        self.assertEqual(telemetry_events[1]["data"]["metrics"]["session_usage"]["total_tokens"], 20)
        final_events = [item for item in emitted_events if item["event"] == "assistant.final"]
        self.assertEqual(len(final_events), 1)

    async def test_poll_emits_full_interrupt_list(self) -> None:
        session_id = "session-2"
        config = default_hitl_session_config().model_copy(update={"title": "interrupt list"})

        interrupted_detail = SessionDetail(
            session_id=session_id,
            title=config.title,
            status="interrupted",
            provider=config.provider,
            model_name=config.model_name,
            created_at="2026-04-19T00:00:00+00:00",
            updated_at="2026-04-19T00:00:00+00:00",
            message_count=1,
            total_usage={},
            total_cost_usd=None,
            last_error=None,
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
            context_window={"percent": "4%"},
            last_response=None,
            interrupts=[
                InterruptInfo(
                    interrupt_id="resume-1",
                    type="approval",
                    payload={"question": "是否继续？"},
                ),
                InterruptInfo(
                    interrupt_id="resume-2",
                    type="user_input",
                    payload={"question": "补充发布窗口"},
                ),
            ],
            multi_agent_enabled=config.multi_agent.enabled(),
            specialist_count=config.multi_agent.specialist_count(),
        )
        metrics = TurnMetrics(
            turn_usage={"prompt_tokens": 10},
            session_usage={"total_tokens": 10},
            turn_cost_usd=0.001,
            session_cost_usd=0.001,
            context_window={"percent": "2%"},
            agent_metrics=[],
        )
        event_queue: asyncio.Queue = asyncio.Queue()

        with patch.object(self.backend, "get_session", AsyncMock(return_value=interrupted_detail)), patch.object(
            self.backend,
            "_load_runtime_turn_metrics",
            AsyncMock(return_value=metrics),
        ):
            result = await self.backend._poll_until_pause_or_done(
                session_id,
                event_queue=event_queue,
            )

        self.assertEqual(result.status, "interrupted")
        self.assertEqual(len(result.interrupts or []), 2)

        emitted = await event_queue.get()
        self.assertEqual(emitted["event"], "session.interrupted")
        self.assertEqual(len(emitted["data"]["interrupts"]), 2)
        self.assertEqual(emitted["data"]["interrupt"]["interrupt_id"], "resume-1")
