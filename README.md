# Motus Agent Workbench

Motus Agent Workbench 是一个基于 Motus SDK 的本地 Agent 工作台，提供统一 Python 后端、HITL 会话链路、工具与 skill 运行时、Workflow 编排能力，以及面向日常使用的 React WebUI。

项目目标不是只做一个聊天壳，而是把 **会话、工具调用、审批、追踪、代码预览、可视化表达** 收敛到同一套可复用的本地 Agent 架构里，方便后续继续接桌面端、Tauri 或其他 UI。

## 核心能力

- Session-first 架构：每个会话有独立配置、消息历史、usage/cost 统计、标题和状态机。
- 统一 backend 抽象：WebUI 通过 `core.backends` 适配本地 backend 与 HITL backend。
- HITL：支持 interrupt / resume、工具审批、问题回填、运行中 telemetry 与恢复。
- Workflow：支持工作流注册、规划、执行、取消、终止与 tracing。
- 代码预览：支持 HTML / React / Python 快速运行与 Python 终端输出。
- 可视化增强：支持 Mermaid、结构化图表和数据分析图表内嵌。
- WebUI：覆盖会话、工作流、追踪、运行时目录、预览窗口、主题与 i18n。

## 技术栈

- 后端：Python 3.14、FastAPI、Motus SDK、uv
- 前端：React 19、TypeScript、Vite、TanStack Query、Tailwind CSS 4
- 测试：pytest、Vitest、Playwright
- 图表与渲染：Mermaid、ECharts、highlight.js、xterm

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
skills/                项目内运行时 skill 入口
tests/                 Python 测试
tools/integrations/    工具实现与第三方集成
vendor/minimax-skills/ 第三方 skills 子模块
web/                   React WebUI
runtime/               本地运行产物，默认不入库
```

更详细说明见：

- `docs/项目结构梳理.md`
- `docs/开发文档.md`
- `docs/前端接入说明.md`

## 快速开始

### 1. 克隆仓库

如果是首次拉取，建议带上 submodule：

```bash
git clone --recurse-submodules <repo-url>
cd motus_ui
```

如果已经拉下仓库，再补一次：

```bash
git submodule update --init --recursive
```

### 2. 准备环境变量

```bash
cp .env.example .env
```

常用变量：

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `FIRECRAWL_KEY` 或 `FIRECRAWL_API_KEY`
- `APP_BACKEND_MODE`
- `MOTUS_TRACING_*`

真实密钥只写本地 `.env`，不要提交到仓库。

### 3. 安装依赖

```bash
uv sync
cd web
npm install
cd ..
```

### 4. 启动后端

```bash
uv run agent-server
```

可选入口：

```bash
uv run agent-hitl-server
uv run agent-tui
```

默认常用地址：

- API：`http://127.0.0.1:8000/api`
- WebUI：按 Vite 输出为准，通常是 `http://127.0.0.1:5173`

### 5. 启动 WebUI

```bash
cd web
npm run dev
```

## 常用命令

后端：

```bash
uv run pytest
uv run python -m py_compile apps/*.py core/**/*.py tools/**/*.py scripts/**/*.py
uv run python -m scripts.smoke.run_all
```

前端：

```bash
cd web
npm run build
npm run test
npm run e2e
npm run lint
```

## 一条最小 API 示例

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

## 仓库约定

- `runtime/`、`release/`、`.venv/`、`node_modules/`、`web/dist/`、coverage 和 test-results 不入库。
- 会话日志、trace、上传文件、预览输出和调试截图默认视为敏感数据。
- `skills/` 是运行时入口层，`tools/integrations/` 是实现层工具代码，两者不要混用。
- `vendor/minimax-skills/` 以 Git submodule 方式接入，保留上游历史与许可证边界。

## 文档入口

- `AGENTS.md`：贡献者与编码约定
- `CONTRIBUTING.md`：贡献流程与 PR 要求
- `SECURITY.md`：安全策略与敏感数据说明
- `docs/runtime-requirements.md`：工具、MCP、skills 的运行时依赖
- `docs/open-source-release-checklist.md`：开源发布检查清单
- `docs/open-source-audit.md`：当前仓库开源整理审计记录

## License

本仓库使用 **Apache License 2.0**，即 **Apache-2.0**。

之所以采用 Apache-2.0，是为了与当前 Motus 生态的开源许可证策略保持一致，也方便后续在企业和个人场景中复用、修改和分发。

注意：

- 根仓库源码与文档适用 `LICENSE` 中的 Apache-2.0 条款。
- `vendor/minimax-skills/` 是第三方上游仓库子模块，保留其自身历史与许可证信息。
