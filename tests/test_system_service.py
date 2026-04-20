import os
import unittest
from unittest.mock import patch

from core.services.system import SystemService


class SystemServiceTests(unittest.TestCase):
    def test_hitl_meta_exposes_interrupts_and_dynamic_session_config(self) -> None:
        with patch.dict(os.environ, {"APP_BACKEND_MODE": "hitl"}, clear=False):
            meta = SystemService(server_started_at="2026-04-19T00:00:00+00:00").get_app_meta()

        self.assertEqual(meta.backend_mode, "hitl")
        self.assertTrue(meta.supports_interrupts)
        self.assertTrue(meta.supports_dynamic_session_config)
        self.assertFalse(meta.supports_preview)


if __name__ == "__main__":
    unittest.main()
