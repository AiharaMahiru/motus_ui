import unittest

from core.llm.costs import calculate_usage_cost, resolve_pricing_model


class CostCalculationTests(unittest.TestCase):
    def test_calculates_gpt_4o_cost_from_prompt_and_completion_tokens(self) -> None:
        cost = calculate_usage_cost(
            "gpt-4o",
            {
                "prompt_tokens": 4157,
                "completion_tokens": 15,
                "total_tokens": 4172,
            },
        )

        self.assertAlmostEqual(cost or 0.0, 0.0105425)

    def test_calculates_cached_input_discount(self) -> None:
        cost = calculate_usage_cost(
            "gpt-4o",
            {
                "prompt_tokens": 1000,
                "completion_tokens": 100,
                "prompt_tokens_details": {
                    "cached_tokens": 400,
                },
            },
        )

        self.assertAlmostEqual(cost or 0.0, 0.003)

    def test_resolves_provider_and_dated_model_names(self) -> None:
        self.assertEqual(resolve_pricing_model("openai/gpt-4o-2024-08-06"), "gpt-4o")
        self.assertEqual(resolve_pricing_model("gpt-5.4 mini"), "gpt-5.4-mini")


if __name__ == "__main__":
    unittest.main()
