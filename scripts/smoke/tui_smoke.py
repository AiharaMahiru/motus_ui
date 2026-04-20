from __future__ import annotations

import asyncio
import uuid
from pathlib import Path

from textual.widgets import Input, ListView, TextArea

from core.schemas.session import SessionCreateRequest
from core.chat import ChatService
from core.ui.tui_app import MotusTUIApp
from scripts.smoke.common import SmokeCaseResult, case_result, now_iso


async def run() -> list[SmokeCaseResult]:
    setup_service = ChatService()
    restored_title = f"TUI recovery regression {uuid.uuid4().hex[:8]}"
    restored_detail = setup_service.create_session(
        SessionCreateRequest(
            title=restored_title,
            enabled_tools=[],
        )
    )

    started_at = now_iso()
    app = MotusTUIApp(chat_service=ChatService())
    screenshot_path = Path("/opt/Agent/runtime/smoke/tui-step-event.svg")

    async with app.run_test(size=(140, 42)) as pilot:
        await pilot.pause()
        composer = app.query_one("#composer", TextArea)
        sessions_list = app.query_one("#sessions-list", ListView)
        session_search = app.query_one("#session-search", Input)
        runtime_panel = app.query_one("#runtime-panel")
        runtime_alerts = app.query_one("#config-runtime-alerts")
        timeout_input = app.query_one("#config-timeout-seconds", Input)
        restored_session = app.sessions.get(restored_detail.session_id)

        app._set_active_session(restored_detail.session_id)
        app._append_step_entry(
            restored_detail.session_id,
            "session.started",
            {
                "content": "smoke step-bar display check",
                "timestamp": "2026-04-16T12:34:56",
            },
        )
        await pilot.pause()

        screenshot_svg = app.export_screenshot(title="tui-smoke")
        screenshot_path.write_text(screenshot_svg, encoding="utf-8")
        step_text_present = "step bar" in screenshot_svg and "display check" in screenshot_svg

        passed = (
            app.active_session_id is not None
            and composer is not None
            and sessions_list is not None
            and session_search is not None
            and runtime_panel is not None
            and runtime_alerts is not None
            and timeout_input is not None
            and len(app.sessions) >= 1
            and restored_session is not None
            and restored_session.title == restored_title
            and restored_detail.session_id in app.visible_session_ids
            and step_text_present
        )

        return [
            case_result(
                name="TUI headless startup",
                started_at=started_at,
                status="passed" if passed else "failed",
                summary="TUI restored history sessions and rendered the system event strip" if passed else "TUI session recovery or system event strip rendering did not meet expectations",
                details=[
                    f"active_session_id={app.active_session_id}",
                    f"session_count={len(app.sessions)}",
                    f"visible_session_ids={app.visible_session_ids}",
                    f"restored_session_id={restored_detail.session_id}",
                    f"restored_title={restored_title!r}",
                    f"restored_found={restored_session is not None}",
                    f"composer_id={composer.id}",
                    f"sessions_list_id={sessions_list.id}",
                    f"session_search_id={session_search.id}",
                    f"runtime_panel_id={runtime_panel.id}",
                    f"runtime_alerts_id={runtime_alerts.id}",
                    f"timeout_input_value={timeout_input.value!r}",
                    f"step_event_text_present={step_text_present}",
                ],
                artifacts=[str(screenshot_path)],
                error=None if passed else "TUI key components were not initialized",
            )
        ]


def main() -> None:
    results = asyncio.run(run())
    for item in results:
        print(f"[{item.status}] {item.name}: {item.summary}")


if __name__ == "__main__":
    main()
