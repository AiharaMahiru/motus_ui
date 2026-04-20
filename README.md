# Motus Agent Workbench

Motus Agent Workbench 是一个基于 Motus SDK 的本地 Agent 项目，包含统一 Python 后端、HITL 会话能力、工具与 skill 运行时，以及 React WebUI。项目目标是把会话、工具调用、工作流、追踪、代码预览和可视化输出整合为可复用的本地 Agent 工作台。

## 功能概览

- 多轮 session：会话级记忆、标题生成、usage/cost 统计和上下文窗口信息。
- 统一 backend：WebUI 通过 `core.backends` 适配 local / HITL 模式。
- HITL：支持 interrupt / resume、审批卡片、运行中 telemetry 和恢复状态。
- 工具与 skills：内置系统工具、网页研究、Office 文档、canvas 预览和内嵌可视化 skill。
- Workflow：支持工作流注册、运行、取消、终止和 tracing。
- WebUI：会话、工作流、预览窗口、追踪、运行时目录、主题和 i18n。
- 代码预览：支持 HTML / React / Python 快速预览与 Python 终端输出。

## 项目结构

```text
apps/                  启动入口
core/                  后端核心运行时代码
core/backends/         UI 复用的 session backend 抽象
core/chat/             会话服务、消息存储、标题生成
core/preview/          HTML / React / Python 预览运行时
core/servers/          FastAPI 与 HITL 服务入口
core/schemas/          前后端共享 schema
core/workflows/        工作流注册、执行和持久化
docs/                  开发文档、接入说明、smoke 记录
scripts/smoke/         系统级 smoke 脚本
skills/                项目内运行时 skill
tests/                 Python 测试
tools/integrations/    工具实现与第三方集成
web/                   React WebUI
runtime/               本地运行产物，默认不入库
```

更详细说明见 `docs/项目结构梳理.md`、`docs/开发文档.md` 和 `docs/前端接入说明.md`。

## 快速开始

```bash
cp .env.example .env
uv sync
uv run agent-server
```

另开终端启动 WebUI：

```bash
cd web
npm install
npm run dev
```

常用入口：

- 后端 API：`http://127.0.0.1:8000/api`
- WebUI dev server：按 Vite 输出为准，通常是 `http://127.0.0.1:5173`
- HITL server：`uv run agent-hitl-server`

## 环境变量

真实密钥只写入本地 `.env`，不要提交到仓库。公开配置模板见 `.env.example`。

常用变量：

- `OPENAI_API_KEY`：OpenAI-compatible provider key。
- `OPENAI_BASE_URL`：可选，自定义兼容网关地址。
- `FIRECRAWL_KEY` 或 `FIRECRAWL_API_KEY`：网页搜索与抓取工具。
- `APP_BACKEND_MODE`：可选，选择 local / hitl 等后端模式。
- `MOTUS_TRACING_*`：可选，Motus tracing 相关配置。

## 开发命令

```bash
uv run pytest
uv run python -m py_compile apps/*.py core/**/*.py tools/**/*.py scripts/**/*.py
uv run python -m scripts.smoke.run_all
```

```bash
cd web
npm run build
npm run test
npm run e2e
npm run lint
```

## API 示例

创建会话：

```bash
curl -s http://127.0.0.1:8000/api/sessions \
  -H 'Content-Type: application/json' \
  -d '{"system_prompt":"你是一个可靠的中文助理。","model_name":"gpt-4o"}'
```

发送消息：

```bash
curl -s http://127.0.0.1:8000/api/sessions/<session_id>/messages \
  -H 'Content-Type: application/json' \
  -d '{"content":"用一句话介绍这个项目。"}'
```

流式消息：

```bash
curl -N http://127.0.0.1:8000/api/sessions/<session_id>/messages/stream \
  -H 'Content-Type: application/json' \
  -d '{"content":"先调用工具，再总结结果。"}'
```

## 开源边界

以下内容默认不应进入公开仓库：

- `.env`、真实 API Key 和私有 MCP endpoint。
- `runtime/` 下的会话、上传文件、trace、预览输出和截图。
- `release/` 下的压缩包。
- `.venv/`、`node_modules/`、`web/dist/`、`web/coverage/`、`web/test-results/`。
- `__pycache__/`、`*.pyc`、`*.egg-info/` 和本地任务 scratch 文件。

发布前请执行 `docs/open-source-release-checklist.md`。

## 文档入口

- `AGENTS.md`：贡献者与编码约定。
- `CONTRIBUTING.md`：贡献流程与 PR 要求。
- `SECURITY.md`：安全策略与敏感数据说明。
- `docs/runtime-requirements.md`：工具、MCP、skills 的运行时依赖。
- `docs/open-source-release-checklist.md`：开源发布前检查清单。

## License

许可证尚未选择。正式开源前请添加 `LICENSE`，并同步更新本节。
