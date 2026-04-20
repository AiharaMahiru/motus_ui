from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import Any

from motus.models.pricing import calculate_cost as motus_calculate_cost


MODEL_PRICING_ALIASES = {
    "gpt-5.4 mini": "gpt-5.4-mini",
    "gpt-5.4 nano": "gpt-5.4-nano",
    "gpt-5-mini": "gpt-5.4-mini",
    "gpt-5-nano": "gpt-5.4-nano",
}


@dataclass(frozen=True)
class TokenPricing:
    """按 1M token 计价的文本模型价格。"""

    input_per_million: float
    output_per_million: float
    cached_input_per_million: float | None = None


OPENAI_TEXT_PRICING: dict[str, TokenPricing] = {
    # OpenAI API pricing, USD / 1M tokens. 这些值只用于 Motus SDK 未内置价格时兜底。
    "gpt-5.4": TokenPricing(input_per_million=2.00, cached_input_per_million=0.20, output_per_million=8.00),
    "gpt-5.4-mini": TokenPricing(input_per_million=0.40, cached_input_per_million=0.04, output_per_million=1.60),
    "gpt-5.4-nano": TokenPricing(input_per_million=0.05, cached_input_per_million=0.005, output_per_million=0.40),
    "gpt-5": TokenPricing(input_per_million=2.00, cached_input_per_million=0.20, output_per_million=8.00),
    "gpt-4.1": TokenPricing(input_per_million=2.00, cached_input_per_million=0.50, output_per_million=8.00),
    "gpt-4.1-mini": TokenPricing(input_per_million=0.40, cached_input_per_million=0.10, output_per_million=1.60),
    "gpt-4.1-nano": TokenPricing(input_per_million=0.10, cached_input_per_million=0.025, output_per_million=0.40),
    "gpt-4o": TokenPricing(input_per_million=2.50, cached_input_per_million=1.25, output_per_million=10.00),
    "gpt-4o-mini": TokenPricing(input_per_million=0.15, cached_input_per_million=0.075, output_per_million=0.60),
}


def normalize_pricing_model(model_name: str | None) -> str | None:
    if model_name is None:
        return None
    model_key = model_name.strip().lower()
    if not model_key:
        return None
    model_key = model_key.split("/")[-1]
    model_key = MODEL_PRICING_ALIASES.get(model_key, model_key)
    if model_key in OPENAI_TEXT_PRICING:
        return model_key

    # 支持带日期后缀的 OpenAI 模型名，例如 gpt-4o-2024-08-06。
    for candidate in sorted(OPENAI_TEXT_PRICING, key=len, reverse=True):
        if model_key.startswith(f"{candidate}-"):
            return candidate
    return model_key


def resolve_pricing_model(model_name: str | None, pricing_model: str | None = None) -> str | None:
    if pricing_model:
        return normalize_pricing_model(pricing_model)
    if model_name is None:
        return None
    return normalize_pricing_model(model_name)


def numeric_usage_value(usage: dict[str, Any], *keys: str) -> float:
    for key in keys:
        value = usage.get(key)
        if isinstance(value, (int, float)):
            return float(value)
    return 0.0


def cached_input_tokens(usage: dict[str, Any]) -> float:
    cached_tokens = numeric_usage_value(usage, "cached_tokens", "cached_input_tokens")
    prompt_details = usage.get("prompt_tokens_details")
    if isinstance(prompt_details, dict):
        cached_tokens += numeric_usage_value(prompt_details, "cached_tokens")
    input_details = usage.get("input_tokens_details")
    if isinstance(input_details, dict):
        cached_tokens += numeric_usage_value(input_details, "cached_tokens")
    return cached_tokens


def calculate_openai_text_cost(model_name: str | None, usage: dict[str, Any]) -> float | None:
    model_key = normalize_pricing_model(model_name)
    if model_key is None:
        return None
    pricing = OPENAI_TEXT_PRICING.get(model_key)
    if pricing is None:
        return None

    input_tokens = numeric_usage_value(usage, "prompt_tokens", "input_tokens")
    output_tokens = numeric_usage_value(usage, "completion_tokens", "output_tokens")
    cached_tokens = min(cached_input_tokens(usage), input_tokens)
    uncached_input_tokens = max(input_tokens - cached_tokens, 0.0)
    cached_price = pricing.cached_input_per_million or pricing.input_per_million

    cost = (
        uncached_input_tokens * pricing.input_per_million
        + cached_tokens * cached_price
        + output_tokens * pricing.output_per_million
    ) / 1_000_000
    return cost if cost > 0 else 0.0


def diff_usage(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    delta: dict[str, Any] = {}
    keys = set(before) | set(after)
    for key in keys:
        before_value = before.get(key, 0)
        after_value = after.get(key, 0)
        if isinstance(before_value, dict) and isinstance(after_value, dict):
            nested = diff_usage(before_value, after_value)
            if nested:
                delta[key] = nested
            continue
        if isinstance(before_value, (int, float)) and isinstance(after_value, (int, float)):
            diff_value = after_value - before_value
            if diff_value:
                delta[key] = diff_value
    return delta


def merge_usage(*usages: dict[str, Any]) -> dict[str, Any]:
    """递归合并多个 usage 字典。

    Motus 的 usage 结构可能包含嵌套字段，例如 cached / reasoning / tool 维度。
    多代理场景下，需要把主管和所有子代理的 usage 聚合到一个稳定结构里。
    """

    merged: dict[str, Any] = {}
    for usage in usages:
        for key, value in usage.items():
            if isinstance(value, dict):
                existing = merged.get(key, {})
                if not isinstance(existing, dict):
                    existing = {}
                merged[key] = merge_usage(existing, value)
                continue
            if isinstance(value, (int, float)):
                merged[key] = merged.get(key, 0) + value
                continue
            # usage 中极少出现非数值字段。这里保留最后一个值，避免聚合时直接丢失结构。
            merged[key] = deepcopy(value)
    return merged


def calculate_usage_cost(
    model_name: str | None,
    usage: dict[str, Any],
    pricing_model: str | None = None,
) -> float | None:
    resolved_model = resolve_pricing_model(model_name, pricing_model)
    openai_cost = calculate_openai_text_cost(resolved_model, usage)
    if openai_cost is not None:
        return openai_cost
    return motus_calculate_cost(resolved_model, usage)
