import unittest

from core.agents.factory import build_system_prompt


class AgentPromptTests(unittest.TestCase):
    def test_build_system_prompt_adds_inline_visualization_baseline_guidance(self) -> None:
        base = "你是一个可靠的中文助理。"

        result = build_system_prompt(base, [])

        self.assertIn(base, result)
        self.assertIn("Mermaid", result)
        self.assertIn("viz", result)

    def test_build_system_prompt_includes_inline_visualization_guidance(self) -> None:
        result = build_system_prompt(
            "你是一个可靠的中文助理。",
            ["bash", "load_skill", "to_do"],
        )

        self.assertIn("Mermaid", result)
        self.assertIn("viz", result)
        self.assertIn("inline_visualization", result)
        self.assertIn("Python", result)


if __name__ == "__main__":
    unittest.main()
