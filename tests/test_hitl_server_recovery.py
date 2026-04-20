import shutil
import unittest
import uuid

from fastapi.testclient import TestClient
from motus.models import ChatMessage
from motus.serve.interrupt import InterruptMessage
from motus.serve.schemas import SessionStatus

from core.config.paths import HITL_SESSIONS_DIR
from core.agents.hitl_agent import default_hitl_session_config
from core.servers.hitl import create_hitl_app
from core.servers.hitl_telemetry import HitlTelemetryManifest, save_hitl_session_telemetry
from core.servers.hitl_state import PersistentSessionStore


class HitlServerRecoveryTests(unittest.TestCase):
    def test_hitl_app_restores_persisted_session_and_config(self) -> None:
        session_id = str(uuid.uuid4())
        self.addCleanup(lambda: shutil.rmtree(HITL_SESSIONS_DIR / session_id, ignore_errors=True))

        with TestClient(create_hitl_app()) as client:
            created = client.put(
                f"/sessions/{session_id}",
                json={
                    "state": [
                        {"role": "user", "content": "第一条"},
                        {"role": "assistant", "content": "第二条"},
                    ]
                },
            )
            self.assertEqual(created.status_code, 201)

            config_payload = default_hitl_session_config().model_dump(exclude_none=True)
            config_payload["title"] = "恢复测试会话"
            config_payload["enabled_tools"] = ["read_file"]
            config_payload["max_steps"] = 128
            config_resp = client.put(
                f"/sessions/{session_id}/config",
                json=config_payload,
            )
            self.assertEqual(config_resp.status_code, 200)

        with TestClient(create_hitl_app()) as client:
            detail = client.get(f"/sessions/{session_id}")
            self.assertEqual(detail.status_code, 200)
            self.assertEqual(detail.json()["status"], "idle")

            messages = client.get(f"/sessions/{session_id}/messages")
            self.assertEqual(messages.status_code, 200)
            self.assertEqual(len(messages.json()), 2)
            self.assertEqual(messages.json()[-1]["content"], "第二条")

            config = client.get(f"/sessions/{session_id}/config")
            self.assertEqual(config.status_code, 200)
            self.assertEqual(config.json()["title"], "恢复测试会话")

    def test_backend_detail_restores_runtime_metadata_and_interrupts(self) -> None:
        session_id = str(uuid.uuid4())
        self.addCleanup(lambda: shutil.rmtree(HITL_SESSIONS_DIR / session_id, ignore_errors=True))

        store = PersistentSessionStore()
        session = store.create(
            session_id=session_id,
            state=[ChatMessage.user_message("请审批部署")],
        )
        session.pending_message = session.state[-1]
        session.pending_interrupts["resume-1"] = InterruptMessage(
            interrupt_id="resume-1",
            payload={"type": "approval", "question": "允许部署到测试环境吗？"},
        )
        session.status = SessionStatus.interrupted
        session.persist()

        config = default_hitl_session_config().model_copy(update={"title": "审批恢复测试"})
        config.enabled_tools = ["read_file", "bash"]

        with TestClient(create_hitl_app()) as client:
            config_resp = client.put(
                f"/sessions/{session_id}/config",
                json=config.model_dump(exclude_none=True),
            )
            self.assertEqual(config_resp.status_code, 200)

        with TestClient(create_hitl_app()) as client:
            summaries = client.get("/backend/sessions")
            self.assertEqual(summaries.status_code, 200)
            summary = next(item for item in summaries.json() if item["session_id"] == session_id)
            self.assertEqual(summary["session_id"], session_id)
            self.assertEqual(summary["title"], "审批恢复测试")
            self.assertEqual(summary["status"], "error")
            self.assertEqual(summary["message_count"], 1)
            self.assertTrue(summary["created_at"])
            self.assertTrue(summary["updated_at"])

            detail = client.get(f"/backend/sessions/{session_id}")
            self.assertEqual(detail.status_code, 200)
            payload = detail.json()
            self.assertEqual(payload["title"], "审批恢复测试")
            self.assertEqual(payload["status"], "error")
            self.assertIn("等待人工确认", payload["last_error"])
            self.assertIsNone(payload["interrupts"])
            self.assertFalse(payload["resume_supported"])
            self.assertIn("等待人工确认", payload["resume_blocked_reason"])
            self.assertEqual(payload["enabled_tools"], ["read_file", "bash"])

    def test_backend_detail_reads_usage_cost_context_and_turn_metrics(self) -> None:
        session_id = str(uuid.uuid4())
        self.addCleanup(lambda: shutil.rmtree(HITL_SESSIONS_DIR / session_id, ignore_errors=True))

        store = PersistentSessionStore()
        store.create(
            session_id=session_id,
            state=[ChatMessage.user_message("统计本轮 token")],
        ).persist()

        config = default_hitl_session_config().model_copy(update={"title": "telemetry 恢复测试"})
        save_hitl_session_telemetry(
            HitlTelemetryManifest(
                session_id=session_id,
                root_usage={
                    "prompt_tokens": 1000,
                    "completion_tokens": 120,
                    "total_tokens": 1120,
                },
                root_cost_usd=0.0037,
                total_usage={
                    "prompt_tokens": 1400,
                    "completion_tokens": 160,
                    "total_tokens": 1560,
                },
                total_cost_usd=0.0041,
                context_window={
                    "estimated_tokens": 4096,
                    "threshold": 65536,
                    "ratio": 0.062,
                    "percent": "6%",
                },
                last_turn_metrics={
                    "turn_usage": {
                        "prompt_tokens": 220,
                        "completion_tokens": 40,
                        "total_tokens": 260,
                    },
                    "session_usage": {
                        "prompt_tokens": 1400,
                        "completion_tokens": 160,
                        "total_tokens": 1560,
                    },
                    "turn_cost_usd": 0.0007,
                    "session_cost_usd": 0.0041,
                    "context_window": {"percent": "6%"},
                    "agent_metrics": [],
                },
                updated_at="2026-04-19T00:00:00+00:00",
            )
        )

        with TestClient(create_hitl_app()) as client:
            config_resp = client.put(
                f"/sessions/{session_id}/config",
                json=config.model_dump(exclude_none=True),
            )
            self.assertEqual(config_resp.status_code, 200)

            detail = client.get(f"/backend/sessions/{session_id}")
            self.assertEqual(detail.status_code, 200)
            payload = detail.json()
            self.assertEqual(payload["total_usage"]["total_tokens"], 1560)
            self.assertEqual(payload["total_cost_usd"], 0.0041)
            self.assertEqual(payload["context_window"]["percent"], "6%")

            metrics = client.get(f"/backend/sessions/{session_id}/turn-metrics")
            self.assertEqual(metrics.status_code, 200)
            metrics_payload = metrics.json()
            self.assertEqual(metrics_payload["turn_usage"]["total_tokens"], 260)
            self.assertEqual(metrics_payload["session_cost_usd"], 0.0041)


if __name__ == "__main__":
    unittest.main()
