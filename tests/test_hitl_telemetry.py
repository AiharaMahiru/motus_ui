import shutil
import unittest
import uuid

from core.agents.multi_agent import MultiAgentUsageTracker
from core.config.paths import HITL_SESSIONS_DIR
from core.schemas.session import SessionCreateRequest
from core.servers.hitl_telemetry import (
    HitlTelemetryTracker,
    load_hitl_session_telemetry,
    save_hitl_session_telemetry,
    HitlTelemetryManifest,
)


class _FakeAgent:
    def __init__(self) -> None:
        self._usage: dict[str, int] = {}
        self.context_window_usage = {
            "estimated_tokens": 512,
            "threshold": 8192,
            "ratio": 0.062,
            "percent": "6%",
        }

    @property
    def usage(self) -> dict[str, int]:
        return dict(self._usage)


class HitlTelemetryTrackerTests(unittest.TestCase):
    def test_persist_tracks_usage_cost_context_and_turn_metrics(self) -> None:
        session_id = f"hitl-telemetry-{uuid.uuid4().hex[:8]}"
        self.addCleanup(lambda: shutil.rmtree(HITL_SESSIONS_DIR / session_id, ignore_errors=True))

        tracker = MultiAgentUsageTracker()
        telemetry = HitlTelemetryTracker(
            session_id=session_id,
            config=SessionCreateRequest(model_name="gpt-4o", pricing_model="gpt-4o"),
            specialist_usage_tracker=tracker,
        )
        agent = _FakeAgent()
        telemetry.attach_agent(agent)

        agent._usage.update(
            {
                "prompt_tokens": 1_000,
                "completion_tokens": 200,
                "total_tokens": 1_200,
            }
        )
        tracker.record_delta(
            agent_name="research-specialist",
            model_name="gpt-4o-mini",
            pricing_model="gpt-4o-mini",
            role="specialist",
            stateful=False,
            delta_usage={
                "prompt_tokens": 500,
                "completion_tokens": 50,
                "total_tokens": 550,
            },
        )

        metrics = telemetry.build_turn_metrics()
        telemetry.persist(metrics=metrics)
        manifest = load_hitl_session_telemetry(session_id)

        self.assertIsNotNone(manifest)
        assert manifest is not None
        self.assertEqual(manifest.total_usage["total_tokens"], 1_750)
        self.assertEqual(manifest.total_usage["prompt_tokens"], 1_500)
        self.assertEqual(manifest.total_usage["completion_tokens"], 250)
        self.assertEqual(manifest.context_window["percent"], "6%")
        self.assertIsNotNone(manifest.total_cost_usd)
        self.assertIsNotNone(manifest.last_turn_metrics)
        self.assertEqual(manifest.last_turn_metrics.turn_usage["total_tokens"], 1_750)
        self.assertEqual(manifest.last_turn_metrics.session_usage["total_tokens"], 1_750)
        self.assertEqual(len(manifest.last_turn_metrics.agent_metrics), 2)

    def test_restore_existing_telemetry_appends_new_root_usage_delta(self) -> None:
        session_id = f"hitl-telemetry-{uuid.uuid4().hex[:8]}"
        self.addCleanup(lambda: shutil.rmtree(HITL_SESSIONS_DIR / session_id, ignore_errors=True))

        save_hitl_session_telemetry(
            HitlTelemetryManifest(
                session_id=session_id,
                root_usage={
                    "prompt_tokens": 120,
                    "completion_tokens": 30,
                    "total_tokens": 150,
                },
                root_cost_usd=0.0006,
                total_usage={
                    "prompt_tokens": 120,
                    "completion_tokens": 30,
                    "total_tokens": 150,
                },
                total_cost_usd=0.0006,
                context_window={"percent": "2%"},
                updated_at="2026-04-19T00:00:00+00:00",
            )
        )

        tracker = MultiAgentUsageTracker()
        telemetry = HitlTelemetryTracker(
            session_id=session_id,
            config=SessionCreateRequest(model_name="gpt-4o", pricing_model="gpt-4o"),
            specialist_usage_tracker=tracker,
        )
        agent = _FakeAgent()
        telemetry.attach_agent(agent)

        self.assertEqual(agent.usage["total_tokens"], 150)

        agent._usage.update(
            {
                "prompt_tokens": 220,
                "completion_tokens": 50,
                "total_tokens": 270,
            }
        )
        metrics = telemetry.build_turn_metrics()

        self.assertEqual(metrics.turn_usage["prompt_tokens"], 100)
        self.assertEqual(metrics.turn_usage["completion_tokens"], 20)
        self.assertEqual(metrics.turn_usage["total_tokens"], 120)
        self.assertEqual(metrics.session_usage["total_tokens"], 270)


if __name__ == "__main__":
    unittest.main()
