import shutil
import unittest
import uuid

from core.chat import utc_now_iso
from core.preview.artifacts import (
    get_preview_request_manifest_path,
    get_preview_run_dir,
    get_preview_run_manifest_path,
)
from core.preview.service import PreviewService
from core.schemas.preview import PreviewRunRequest, PreviewRunResponse


class PreviewServiceRecoveryTests(unittest.IsolatedAsyncioTestCase):
    async def test_get_run_restarts_terminal_preview_from_persisted_request(self) -> None:
        session_id = f"preview-session-{uuid.uuid4().hex[:8]}"
        run_id = uuid.uuid4().hex[:12]
        run_dir = get_preview_run_dir(session_id, run_id)
        run_dir.mkdir(parents=True, exist_ok=True)
        self.addCleanup(lambda: shutil.rmtree(run_dir.parent, ignore_errors=True))

        request = PreviewRunRequest(
            language="python",
            code="value = input('name? ')\nprint(value)\n",
            title="terminal-preview",
        )
        get_preview_request_manifest_path(session_id, run_id).write_text(
            request.model_dump_json(indent=2, exclude_none=True),
            encoding="utf-8",
        )
        (run_dir / "main.py").write_text(request.code, encoding="utf-8")

        stale_response = PreviewRunResponse(
            run_id=run_id,
            session_id=session_id,
            language="python",
            normalized_language="python",
            mode="terminal",
            status="running",
            title="terminal-preview",
            created_at=utc_now_iso(),
            completed_at=None,
            command="python main.py",
            run_dir=str(run_dir),
            source_file="main.py",
            artifact=None,
            terminal=None,
            stdout=None,
            stderr=None,
            error=None,
        )
        get_preview_run_manifest_path(session_id, run_id).write_text(
            stale_response.model_dump_json(indent=2, exclude_none=True),
            encoding="utf-8",
        )

        service = PreviewService()
        restored = await service.get_run(session_id, run_id)

        self.assertEqual(restored.status, "running")
        self.assertEqual(restored.mode, "terminal")
        self.assertIsNotNone(restored.terminal)
        self.assertTrue(restored.terminal.can_write_stdin)

        terminated = await service.terminate_run(session_id, run_id)
        self.assertIn(terminated.status, {"completed", "error"})


if __name__ == "__main__":
    unittest.main()
