from __future__ import annotations

from core.backends.hitl import HitlSessionBackend
from core.backends.local import LocalSessionBackend
from core.chat import ChatService


def create_backend(
    mode: str = "local",
    *,
    hitl_url: str = "http://127.0.0.1:8001",
):
    """统一的 backend 构造入口。

    未来接入新的 UI 平台时，只需要依赖这一层来拿 backend，
    而不需要直接引用 FastAPI server 或具体实现细节。
    """

    normalized = mode.strip().lower()
    if normalized == "hitl":
        return HitlSessionBackend(hitl_url)
    return LocalSessionBackend(ChatService())
