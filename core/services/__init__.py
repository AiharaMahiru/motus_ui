"""服务层包。

避免在包导入阶段把 chat / servers 整体提前拉起，降低循环依赖风险。
调用方应优先直接从具体模块导入，例如：

- `from core.services.system import SystemService`
- `from core.services.tracing import TracingService`
"""

__all__: list[str] = []
