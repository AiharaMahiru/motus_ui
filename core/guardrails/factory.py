from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Callable, Literal

from motus.guardrails import (
    InputGuardrailTripped,
    OutputGuardrailTripped,
    ToolInputGuardrailTripped,
    ToolOutputGuardrailTripped,
)

from core.schemas.guardrails import GuardrailRule, ToolGuardrailConfig


def _compile_flags(rule: GuardrailRule) -> int:
    flags = 0
    if rule.ignore_case:
        flags |= re.IGNORECASE
    if rule.multiline:
        flags |= re.MULTILINE
    if rule.dotall:
        flags |= re.DOTALL
    return flags


def _rule_message(rule: GuardrailRule, fallback: str) -> str:
    return rule.message or fallback


def _agent_trip_exception(direction: Literal["input", "output"]):
    return InputGuardrailTripped if direction == "input" else OutputGuardrailTripped


def build_agent_guardrails(
    rules: list[GuardrailRule] | None,
    *,
    direction: Literal["input", "output"],
) -> list[Callable]:
    """把声明式规则编译成 Motus agent guardrail callable。"""

    compiled: list[Callable] = []
    trip_exception = _agent_trip_exception(direction)

    for index, rule in enumerate(rules or []):
        if rule.kind == "max_length":
            limit = int(rule.max_length or 0)
            message = _rule_message(rule, f"{direction} 长度超过 {limit}")

            def _max_length_guardrail(
                value: str,
                agent: Any = None,
                *,
                _limit: int = limit,
                _message: str = message,
            ) -> None:
                if len(value or "") > _limit:
                    raise trip_exception(_message)
                return None

            _max_length_guardrail.__name__ = f"{direction}_max_length_guardrail_{index}"
            compiled.append(_max_length_guardrail)
            continue

        pattern = re.compile(str(rule.pattern), _compile_flags(rule))

        if rule.kind == "deny_regex":
            def _deny_regex_guardrail(
                value: str,
                agent: Any = None,
                *,
                _pattern: re.Pattern[str] = pattern,
                _message: str = _rule_message(rule, f"{direction} 命中禁止模式"),
            ) -> None:
                if _pattern.search(value or ""):
                    raise trip_exception(_message)
                return None

            _deny_regex_guardrail.__name__ = f"{direction}_deny_regex_guardrail_{index}"
            compiled.append(_deny_regex_guardrail)
            continue

        if rule.kind == "require_regex":
            def _require_regex_guardrail(
                value: str,
                agent: Any = None,
                *,
                _pattern: re.Pattern[str] = pattern,
                _message: str = _rule_message(rule, f"{direction} 缺少必需模式"),
            ) -> None:
                if not _pattern.search(value or ""):
                    raise trip_exception(_message)
                return None

            _require_regex_guardrail.__name__ = f"{direction}_require_regex_guardrail_{index}"
            compiled.append(_require_regex_guardrail)
            continue

        if rule.kind == "rewrite_regex":
            replacement = str(rule.replacement or "")

            def _rewrite_regex_guardrail(
                value: str,
                agent: Any = None,
                *,
                _pattern: re.Pattern[str] = pattern,
                _replacement: str = replacement,
            ) -> str:
                return _pattern.sub(_replacement, value or "")

            _rewrite_regex_guardrail.__name__ = f"{direction}_rewrite_regex_guardrail_{index}"
            compiled.append(_rewrite_regex_guardrail)

    return compiled


def _serialized_tool_input_guardrail_factory(
    rule: GuardrailRule,
    *,
    index: int,
) -> Callable:
    pattern = re.compile(str(rule.pattern), _compile_flags(rule)) if rule.pattern else None

    def _guardrail(**kwargs):
        serialized = json.dumps(kwargs, ensure_ascii=False)
        if rule.kind == "max_length":
            limit = int(rule.max_length or 0)
            if len(serialized) > limit:
                raise ToolInputGuardrailTripped(_rule_message(rule, f"工具输入长度超过 {limit}"))
            return None

        if rule.kind == "deny_regex" and pattern is not None:
            if pattern.search(serialized):
                raise ToolInputGuardrailTripped(_rule_message(rule, "工具输入命中禁止模式"))
            return None

        if rule.kind == "require_regex" and pattern is not None:
            if not pattern.search(serialized):
                raise ToolInputGuardrailTripped(_rule_message(rule, "工具输入缺少必需模式"))
            return None

        if rule.kind == "rewrite_regex" and pattern is not None:
            rewritten = pattern.sub(str(rule.replacement or ""), serialized)
            if rewritten == serialized:
                return None
            try:
                parsed = json.loads(rewritten)
            except json.JSONDecodeError as exc:
                raise ToolInputGuardrailTripped(
                    f"工具输入 rewrite 产生了非法 JSON: {exc}"
                ) from exc
            if not isinstance(parsed, dict):
                raise ToolInputGuardrailTripped("工具输入 rewrite 后必须仍然是对象结构")
            return parsed

        return None

    _guardrail.__name__ = f"tool_input_guardrail_{index}"
    return _guardrail


def _serialized_tool_output_guardrail_factory(
    rule: GuardrailRule,
    *,
    index: int,
) -> Callable:
    pattern = re.compile(str(rule.pattern), _compile_flags(rule)) if rule.pattern else None

    def _guardrail(value: Any):
        serialized = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
        if rule.kind == "max_length":
            limit = int(rule.max_length or 0)
            if len(serialized) > limit:
                raise ToolOutputGuardrailTripped(_rule_message(rule, f"工具输出长度超过 {limit}"))
            return None

        if rule.kind == "deny_regex" and pattern is not None:
            if pattern.search(serialized):
                raise ToolOutputGuardrailTripped(_rule_message(rule, "工具输出命中禁止模式"))
            return None

        if rule.kind == "require_regex" and pattern is not None:
            if not pattern.search(serialized):
                raise ToolOutputGuardrailTripped(_rule_message(rule, "工具输出缺少必需模式"))
            return None

        if rule.kind == "rewrite_regex" and pattern is not None:
            return pattern.sub(str(rule.replacement or ""), serialized)

        return None

    _guardrail.__name__ = f"tool_output_guardrail_{index}"
    return _guardrail


def make_tool_path_guardrail(
    *,
    allowed_roots: list[str],
    path_fields: list[str],
    require_absolute_paths: bool,
) -> Callable:
    """构造路径约束 guardrail。

    主要用于 read_file / write_file / edit_file 这类工具，避免 agent 越界访问。
    """

    resolved_roots = [Path(item).resolve() for item in allowed_roots if item]

    def _guardrail(**kwargs):
        for field in path_fields:
            raw_value = kwargs.get(field)
            if not isinstance(raw_value, str) or not raw_value.strip():
                continue

            path = Path(raw_value)
            if require_absolute_paths and not path.is_absolute():
                raise ToolInputGuardrailTripped(f"{field} 必须是绝对路径")

            resolved = path.resolve()
            if resolved_roots and not any(resolved.is_relative_to(root) for root in resolved_roots):
                joined = ", ".join(str(root) for root in resolved_roots)
                raise ToolInputGuardrailTripped(f"{field} 超出允许工作区，允许根目录: {joined}")
        return None

    _guardrail.__name__ = "tool_path_guardrail"
    return _guardrail


def build_tool_guardrails(
    configs: list[ToolGuardrailConfig] | None,
) -> dict[str, dict[str, list[Callable]]]:
    """把声明式工具 guardrail 配置编译成按工具分组的 callable。"""

    result: dict[str, dict[str, list[Callable]]] = {}

    for config in configs or []:
        input_guards = [
            _serialized_tool_input_guardrail_factory(rule, index=index)
            for index, rule in enumerate(config.input_rules)
        ]
        output_guards = [
            _serialized_tool_output_guardrail_factory(rule, index=index)
            for index, rule in enumerate(config.output_rules)
        ]
        if config.path_fields and config.allowed_roots:
            input_guards.insert(
                0,
                make_tool_path_guardrail(
                    allowed_roots=config.allowed_roots,
                    path_fields=config.path_fields,
                    require_absolute_paths=config.require_absolute_paths,
                ),
            )
        result[config.tool_name] = {
            "input": input_guards,
            "output": output_guards,
        }

    return result
