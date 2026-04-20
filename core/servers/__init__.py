from __future__ import annotations

from typing import Any


def create_app(*args: Any, **kwargs: Any):
    """延迟导入 API app，避免 package import 时触发循环依赖。"""

    from .api import create_app as _create_app

    return _create_app(*args, **kwargs)


def build_hitl_server():
    """延迟导入 HITL server，避免与 agent 构造互相循环。"""

    from .hitl import build_hitl_server as _build_hitl_server

    return _build_hitl_server()


def __getattr__(name: str) -> Any:
    if name == "app":
        from .api import app as _app

        return _app
    if name == "create_app":
        return create_app
    if name == "build_hitl_server":
        return build_hitl_server
    raise AttributeError(name)


__all__ = ["app", "create_app", "build_hitl_server"]
