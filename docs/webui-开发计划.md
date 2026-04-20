# WebUI 优先开发计划

## 目标

当前优先级明确调整为：先完成 `WebUI`，再继续 `Tauri` 壳集成。

本阶段的完成定义不是“把页面跑起来”，而是：

- Web 端覆盖当前后端已具备的核心能力
- 不改坏现有 `/api/*` 与 SSE 契约
- 自动化 smoke 能稳定证明 WebUI 可用
- 结果继续写入项目内 `runtime/` 与现有结果文档

## 当前基线

当前仓库已经具备可直接承接 WebUI 的后端基础：

- 会话 API、workflow API、tracing API 已统一暴露在 `core/servers/api.py`
- 会话创建模型已经支持 `max_steps=1024`、`timeout_seconds=600`、`thinking`、`enabled_tools`、`mcp_servers`、`multi_agent`
- 流式事件已经稳定输出 `session.started`、`assistant.step`、`assistant.final`、`session.error`、`done`
- 会话恢复已经基于 `runtime/sessions/*/meta.json` 与 `runtime/conversation_logs/*.jsonl`
- 环境变量已经统一从项目根 `.env` 读取
- 现有系统级 smoke 已经具备 Python 侧的统一执行入口和结果文档写回能力

这意味着 WebUI 的正确做法是“复用现有后端”，而不是再做一套新的服务层。

## 阶段目标

### P0：后端补齐 WebUI 最小元信息接口

目标：不给前端猜环境。

本阶段需要补两个轻量接口：

- `GET /api/meta`
  - 返回 `app_version`
  - 返回 `desktop_mode`
  - 返回 `api_base_url`
  - 返回 `runtime_dir`
  - 返回 `server_started_at`
- `GET /api/runtime/requirements`
  - 直接复用 `core/runtime_catalog.py` 的检测结果
  - 让 WebUI 能展示 tools / skills / mcp 运行时是否就绪

建议落点：

- `core/schemas/meta.py`
- `core/schemas/runtime.py`
- `core/servers/api.py`
- 如有必要，在 `core/services/` 增加只读服务封装

说明：

- `POST /api/sessions/{id}/messages/stream` 继续保持不变
- 不新增 UI 私有接口去绕开现有 schema

### P1：搭建 Web 工程骨架

目标：先把“能承载全部功能的壳”搭起来。

建议技术选型：

- `React + Vite + TypeScript`
- `React Router`
- `TanStack Query`
- `Zod`
- `Vitest + Testing Library`
- `Playwright`

建议目录：

```text
web/
  src/
    app/
    features/
      meta/
      sessions/
      chat/
      workflows/
      tracing/
      runtime/
    shared/
      api/
      stream/
      ui/
      lib/
  tests/
```

建议同时完成：

- 统一 `fetch` 客户端
- `POST` 型 SSE 解析器
- 全局查询缓存
- 基础主题、布局、状态色、加载态、错误态

### P2：完成会话与聊天主流程

目标：先把用户每天都会用的核心链路做完整。

必须覆盖：

- 会话列表
  - 加载历史会话
  - 新建会话
  - 删除会话
  - 按标题搜索
- 主聊天区
  - 历史消息展示
  - 用户发送消息
  - 正在流式回复时禁用重复发送
  - 流结束后写入最终 assistant 消息
- 步骤流展示
  - `assistant.step` 嵌入消息流而不是独立悬浮
  - 默认只显示自然语言摘要、状态徽标、时间
  - 点击后展开 `tool_calls` 与原始细节
- 指标面板
  - `turn_usage`
  - `session_usage`
  - `turn_cost_usd`
  - `session_cost_usd`
  - `agent_metrics`

必须支持的会话配置：

- `title`
- `system_prompt`
- `model_name`
- `max_steps`
- `timeout_seconds`
- `thinking.enabled`
- `thinking.effort`
- `thinking.verbosity`
- `thinking.budget_tokens`
- `enabled_tools`
- `mcp_servers`
- `multi_agent`

说明：

- `multi_agent` 建议先做“结构化表单 + JSON 高级模式”
- `mcp_servers` 建议先做“远端 HTTP / 本地 stdio”两种 transport 的显式切换表单

### P3：完成 workflow / tracing / runtime 可视化

目标：把后端已经做完但当前只有 API 的能力补到 WebUI。

必须覆盖：

- workflow 列表页
- workflow run 启动与轮询
- workflow run 详情
- session tracing 状态查看
- session tracing 导出
- workflow tracing 状态查看
- workflow tracing 导出
- runtime requirements 面板
- meta 面板

建议布局：

- 左侧：会话与 workflow 导航
- 中间：主工作区
- 右侧：配置 / tracing / runtime / metrics 侧栏

### P4：完成自动化测试与系统级 smoke

目标：WebUI 不是演示稿，而是可回归的产品入口。

本阶段至少要补三层测试：

1. 单元测试
   - SSE 解析器
   - 请求响应模型转换
   - 会话状态 reducer / store
2. 组件测试
   - 会话列表
   - 步骤卡片
   - 指标面板
   - tracing / runtime 面板
3. 系统级 smoke
   - 启动 Python API
   - 启动 Web dev server 或 preview server
   - 用 Playwright 走一遍真实页面链路
   - 最终把现象写回 `docs/system-smoke-test-results.md`

建议新增：

- `scripts/smoke/webui.py`
- `web/playwright.config.ts`
- `web/tests/e2e/chat.spec.ts`
- `web/tests/e2e/workflow.spec.ts`

并更新：

- `scripts/smoke/run_all.py`
- `docs/system-smoke-test-plan.md`

## 执行顺序

推荐严格按下面顺序推进，避免前后返工：

1. 先补 `meta` / `runtime requirements` 接口
2. 再搭 `web/` 骨架与 API/SSE 基础设施
3. 然后做会话列表、聊天区、步骤流、指标区
4. 再做 workflow / tracing / runtime 面板
5. 最后补 Web 单测、组件测试、Playwright smoke
6. Web smoke 稳定后，再把 TUI 降级为 legacy 基线

## TODO 清单

### 后端

- [ ] 新增 `core/schemas/meta.py`
- [ ] 新增 `core/schemas/runtime.py`
- [ ] 在 `core/servers/api.py` 暴露 `GET /api/meta`
- [ ] 在 `core/servers/api.py` 暴露 `GET /api/runtime/requirements`
- [ ] 在 `core/schemas/__init__.py` 补齐新 schema 导出
- [ ] 为新增接口补最小回归测试或 smoke 覆盖

### Web 工程

- [ ] 新建 `web/` Vite + React + TypeScript 工程
- [ ] 建立 feature-first 目录
- [ ] 建立统一 API client
- [ ] 建立 `POST` SSE 流式解析器
- [ ] 建立全局布局、主题变量、空状态、错误态

### 会话与聊天

- [ ] 完成会话列表、搜索、新建、删除、恢复
- [ ] 完成聊天消息渲染与左右布局
- [ ] 完成流式步骤嵌入消息流
- [ ] 完成流式中间状态、错误态、done 收尾
- [ ] 完成 usage / cost / agent_metrics 展示
- [ ] 完成会话配置表单
- [ ] 完成 tools / mcp / multi-agent 配置编辑

### Workflow / Tracing / Runtime

- [ ] 完成 workflow 列表与 run 启动
- [ ] 完成 workflow run 轮询与详情
- [ ] 完成 session tracing 状态与导出
- [ ] 完成 workflow tracing 状态与导出
- [ ] 完成 runtime requirements 检测面板
- [ ] 完成 meta 信息面板

### 测试与文档

- [ ] 配置 `Vitest`
- [ ] 配置 `Playwright`
- [ ] 新增 `scripts/smoke/webui.py`
- [ ] 将 `scripts/smoke/run_all.py` 接入 WebUI smoke
- [ ] 更新 `docs/system-smoke-test-plan.md`
- [ ] 更新 `README.md` 的启动与测试命令
- [ ] WebUI smoke 通过后，将结果写回 `docs/system-smoke-test-results.md`

## 完成标准

满足以下条件，才算当前阶段完成：

- 浏览器可加载 WebUI 并看到历史会话
- 新建会话后可发送消息并收到 `assistant.step` 与 `assistant.final`
- 步骤卡片可折叠展开，且不会撑爆主消息区
- usage / cost / agent_metrics 在 WebUI 可见
- workflow 可启动并查看结果
- session / workflow tracing 可查询并导出
- runtime requirements 可查看当前缺失项
- `uv run python -m scripts.smoke.run_all` 包含 WebUI smoke 且整体通过
- 结果文档和运行产物仍然统一落在项目内 `runtime/`

## 推荐命令

后续进入实现阶段时，优先使用下面这组命令：

```bash
uv run python -m apps.server
cd web && npm install
cd web && npm run dev
cd web && npm run test
cd web && npm run e2e
uv run python -m scripts.smoke.run_all
```

## 风险与规避

- 风险：浏览器端不能直接用原生 `EventSource` 发送 `POST` 请求
  - 规避：前端必须实现 `fetch` 流式读取解析器
- 风险：一开始只做页面，后面再补 smoke，容易返工
  - 规避：`P1` 阶段同步确定测试栈和目录
- 风险：配置表单过早做成复杂树编辑器，拖慢首版交付
  - 规避：先做 80% 常用表单，复杂嵌套给 JSON 高级模式
- 风险：直接删除 TUI 会丢掉当前回归基线
  - 规避：WebUI smoke 稳定前，先保留 TUI 但不再继续投入新功能

## 下一步

下一轮直接进入实现，优先做：

1. `GET /api/meta`
2. `GET /api/runtime/requirements`
3. `web/` 工程骨架
4. 会话列表 + 聊天主流程
