# 系统级 Smoke Test 规划

## 目标

这份计划用于覆盖当前项目最核心的端到端路径，优先验证：

- 入口脚本可启动
- 本地会话可工作
- 多代理可工作
- workflow 可工作
- tracing 可按 session / workflow run 导出
- HTTP API 与本地 backend 行为一致

原则是：

- `P0` 必须可自动化，适合每次重构后快速回归
- `P1` 允许半自动或人工辅助
- `P2` 依赖外部环境，放到更靠后的位置

## 前置条件

- 根目录 `.env` 已配置：
  - `OPENAI_API_KEY`
  - `OPENAI_BASE_URL`
  - `FIRECRAWL_KEY`
- 已执行 `uv sync`

## P0：自动化最小回归集

### 1. 静态与入口校验

命令：

```bash
uv run python -m py_compile apps/*.py core/**/*.py tools/**/*.py
```

期望：

- 无语法错误
- `apps.server` / `apps.tui` / `apps.hitl` 可导入

### 2. 本地会话链路

覆盖：

- 创建 session
- 普通对话
- SSE 中间事件
- session 级 tracing

期望：

- `assistant.step` / `assistant.final` 正常返回
- `SessionDetail.trace_log_dir` 指向 `runtime/traces/sessions/<session_id>/`
- 导出后生成：
  - `tracer_state.json`
  - `trace_viewer.html`
  - `jaeger_traces.json`

### 3. 多代理会话链路

覆盖：

- `SessionCreateRequest.multi_agent`
- specialist 委派
- usage / cost 聚合

期望：

- `TurnMetrics.agent_metrics` 非空
- `specialist_count` 正确
- 子代理 step 事件带 `agent_name`

### 4. Workflow 链路

覆盖：

- `POST /api/workflows/runs`
- 轮询 run 状态
- workflow run 级 tracing

期望：

- run 从 `queued/running` 到 `completed`
- `WorkflowRunDetail.trace_log_dir` 指向 `runtime/traces/workflows/<run_id>/`
- workflow tracing 导出文件完整

### 5. HTTP API 传输层一致性

覆盖：

- session API
- workflow API
- tracing API

建议：

- 用 `uv run agent-server` 启动服务
- 用 `curl` 或 `httpx` 脚本跑一遍本地 backend 已覆盖的关键路径

### 6. WebUI 真实链路

覆盖：

- 启动 Python API
- 启动 Vite WebUI
- 加载历史会话列表
- 新建会话并发送消息
- 展示流式步骤卡片与最终回复
- 启动 workflow run 并显示输出

期望：

- `npm run build` 通过
- `npm run e2e` 通过
- `scripts/smoke/webui.py` 能把 WebUI 日志和 Playwright 现象写回结果文档

## P1：半自动回归集

### 7. HITL 状态机

覆盖：

- 创建 session
- 触发 interrupt
- resume

期望：

- 状态流为 `idle -> running -> interrupted -> running -> idle`

说明：

- 这里更适合单独准备演示 prompt 或 demo agent
- 当前不建议先强行自动化，因为 HITL 依赖 `motus serve` worker 行为

### 8. TUI 基础可用性（legacy 基线）

覆盖：

- 启动 `uv run agent-tui`
- 新建会话
- 发送消息
- 查看嵌入式步骤

期望：

- 不崩溃
- 会话列表、消息流、指标区可更新

## P2：外部依赖回归集

### 9. Firecrawl 网页工具

覆盖：

- `web_search`
- `web_scrape`
- `web_interact`

风险：

- 依赖外部网络和第三方服务稳定性

### 10. MCP 集成

覆盖：

- `remote_http`
- `local_stdio`

风险：

- 依赖外部进程或远端 MCP 服务

## 建议的落地顺序

1. 先实现 `P0` 自动化脚本
2. 再补 `P1` 的手工检查清单
3. 最后把 `P2` 拆成独立 smoke profile，避免拖慢日常回归

## 建议的后续文件

推荐后续补这几类文件：

- `scripts/smoke/local_backend.py`
- `scripts/smoke/http_api.py`
- `scripts/smoke/webui.py`
- `scripts/smoke/workflow_tracing.py`
- `scripts/smoke/README.md`

这样可以把当前规划逐步收敛为真正可执行的 smoke suite。
