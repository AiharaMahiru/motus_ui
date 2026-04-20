from __future__ import annotations

import importlib
import importlib.util
import inspect
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from core.config.paths import TOOL_PLUGINS_DIR
from core.schemas.tool_host import ToolCatalogResponse, ToolDescriptor


ToolFactory = Callable[..., Any]


@dataclass
class ToolBuildContext:
    """构造工具实例时可用的上下文。"""

    sandbox_runtime: Any
    sandbox_config: Any
    session_scoped_todo: bool
    human_in_the_loop: bool


@dataclass
class ToolRegistration:
    name: str
    factory: ToolFactory
    group: str = "default"
    label: str | None = None
    description: str | None = None
    source: str = "runtime"
    persistence: str = "memory"
    human_in_the_loop_only: bool = False


_RUNTIME_TOOL_REGISTRY: dict[str, ToolRegistration] = {}


def register_runtime_tool(
    *,
    name: str,
    factory: ToolFactory,
    group: str = "default",
    label: str | None = None,
    description: str | None = None,
    source: str = "runtime",
    persistence: str = "memory",
    human_in_the_loop_only: bool = False,
) -> None:
    """注册进程级动态工具。"""

    _RUNTIME_TOOL_REGISTRY[name] = ToolRegistration(
        name=name,
        factory=factory,
        group=group,
        label=label,
        description=description,
        source=source,
        persistence=persistence,
        human_in_the_loop_only=human_in_the_loop_only,
    )


def clear_runtime_tools() -> None:
    _RUNTIME_TOOL_REGISTRY.clear()


def _register_descriptor(
    target: dict[str, ToolRegistration],
    registration: ToolRegistration,
) -> None:
    if registration.name in target:
        raise ValueError(f"重复的动态工具名: {registration.name}")
    target[registration.name] = registration


def _registration_from_payload(payload: Any) -> ToolRegistration:
    if isinstance(payload, ToolRegistration):
        return payload
    if isinstance(payload, dict):
        return ToolRegistration(**payload)
    raise TypeError(f"不支持的工具注册负载: {type(payload)!r}")


def _load_module_from_file(path: Path):
    module_name = f"agent_runtime_tool_{path.stem}_{abs(hash(path))}"
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"无法加载工具插件模块: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _invoke_tool_factory(factory: ToolFactory, context: ToolBuildContext) -> Any:
    signature = inspect.signature(factory)
    if len(signature.parameters) == 0:
        return factory()
    return factory(context)


def _load_external_tool_plugins() -> dict[str, ToolRegistration]:
    discovered: dict[str, ToolRegistration] = {}

    def register(*, name: str, factory: ToolFactory, **kwargs: Any) -> None:
        _register_descriptor(
            discovered,
            ToolRegistration(name=name, factory=factory, **kwargs),
        )

    for registration in _RUNTIME_TOOL_REGISTRY.values():
        _register_descriptor(discovered, registration)

    TOOL_PLUGINS_DIR.mkdir(parents=True, exist_ok=True)
    for plugin_path in sorted(TOOL_PLUGINS_DIR.glob("*.py")):
        module = _load_module_from_file(plugin_path)
        register_tools = getattr(module, "register_tools", None)
        if callable(register_tools):
            register_tools(register)
            continue
        tool_payloads = getattr(module, "TOOLS", None)
        if isinstance(tool_payloads, list):
            for item in tool_payloads:
                _register_descriptor(discovered, _registration_from_payload(item))

    raw_module_names = []
    try:
        import os

        raw_module_names = [
            item.strip()
            for item in os.getenv("APP_TOOL_MODULES", "").split(",")
            if item.strip()
        ]
    except Exception:
        raw_module_names = []

    for module_name in raw_module_names:
        module = importlib.import_module(module_name)
        register_tools = getattr(module, "register_tools", None)
        if callable(register_tools):
            register_tools(register)
            continue
        tool_payloads = getattr(module, "TOOLS", None)
        if isinstance(tool_payloads, list):
            for item in tool_payloads:
                _register_descriptor(discovered, _registration_from_payload(item))

    return discovered


def build_dynamic_tool_map(context: ToolBuildContext) -> dict[str, Any]:
    """根据宿主上下文实例化动态工具。"""

    registrations = _load_external_tool_plugins()
    tool_map: dict[str, Any] = {}
    for registration in registrations.values():
        if registration.human_in_the_loop_only and not context.human_in_the_loop:
            continue
        tool_map[registration.name] = _invoke_tool_factory(registration.factory, context)
    return tool_map


def get_tool_catalog(*, include_dynamic: bool = True) -> ToolCatalogResponse:
    registrations = list(_RUNTIME_TOOL_REGISTRY.values())
    if include_dynamic:
        registrations = list(_load_external_tool_plugins().values())
    return ToolCatalogResponse(
        tools=[
            ToolDescriptor(
                name=item.name,
                group=item.group,
                label=item.label,
                description=item.description,
                source=item.source,
                persistence=item.persistence,  # type: ignore[arg-type]
                human_in_the_loop_only=item.human_in_the_loop_only,
            )
            for item in sorted(registrations, key=lambda current: (current.group, current.name))
        ]
    )
