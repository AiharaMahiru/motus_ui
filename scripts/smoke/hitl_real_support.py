from __future__ import annotations

import os

from openai import OpenAI

from core.config.env import load_project_env


load_project_env()


def resolve_real_hitl_model(*, preferred_env_key: str = "SMOKE_REAL_HITL_MODEL") -> tuple[str | None, list[str]]:
    """优先选择当前网关可实际完成请求的模型。"""

    preferred = os.getenv(preferred_env_key, "").strip()
    candidates = [
        preferred or None,
        "gpt-5.4-mini",
        "gpt-5.4",
        "gpt-4o-mini",
        "gpt-4o",
    ]
    deduped: list[str] = []
    for item in candidates:
        if item and item not in deduped:
            deduped.append(item)

    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL")
    if not api_key:
        return None, ["OPENAI_API_KEY 未配置"]

    client = OpenAI(api_key=api_key, base_url=base_url)
    probe_logs: list[str] = []
    for model in deduped:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": "reply with OK"}],
                max_completion_tokens=8,
                timeout=20,
            )
            content = response.choices[0].message.content or ""
            probe_logs.append(f"{model}=ok:{content!r}")
            return model, probe_logs
        except Exception as exc:
            probe_logs.append(f"{model}=error:{type(exc).__name__}:{exc}")

    return None, probe_logs
