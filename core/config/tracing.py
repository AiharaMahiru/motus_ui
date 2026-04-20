from __future__ import annotations

import os
from datetime import datetime

from core.config.paths import RUNTIME_DIR


def ensure_tracing_env_defaults() -> None:
    """为 Motus tracing 补齐项目级默认环境变量。

    Motus 默认会把 trace 输出到相对路径 `traces/trace_<timestamp>/`。
    当前项目已经把运行产物统一收口到 `runtime/`，所以这里在没有显式配置
    `MOTUS_TRACING_DIR` 时，自动把默认目录切到 `runtime/traces/trace_<timestamp>/`。
    """

    if "MOTUS_TRACING_DIR" not in os.environ:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        os.environ["MOTUS_TRACING_DIR"] = str(
            RUNTIME_DIR / "traces" / f"trace_{timestamp}"
        )
