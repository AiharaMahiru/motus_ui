# Motus Agent WebUI

`web/` 是 Motus Agent 的 React 工作台，负责会话、工作流、预览运行时、追踪、运行时目录和高级配置界面。

## 技术栈

- React 19 + TypeScript
- Vite
- TanStack Query
- Tailwind CSS 4
- Vitest + Playwright
- `lucide-react` 图标

## 本地开发

先在项目根目录准备后端环境：

```bash
cp .env.example .env
uv sync
uv run agent-server
```

再启动 WebUI：

```bash
cd web
npm install
npm run dev
```

默认前端会通过 Vite 代理访问后端 `/api/*`。

## 常用命令

```bash
npm run build   # TypeScript 与生产构建
npm run test    # Vitest + coverage
npm run e2e     # Playwright e2e
npm run lint    # ESLint
```

## 目录约定

- `src/app/`：应用 shell、路由和全局 provider。
- `src/features/chat/`：会话页面、输入栏、消息渲染、工具执行、可视化。
- `src/features/previews/`：HTML / React / Python 预览窗口。
- `src/features/sessions/`：会话列表与高级配置面板。
- `src/features/workflows/`：工作流自动编排页面。
- `src/features/runtime/`、`tracing/`、`meta/`：运行时、追踪和元信息面板。
- `src/shared/`：共享 API、i18n、主题与通用组件。

## 开源注意

不要提交 `node_modules/`、`dist/`、`coverage/`、`test-results/` 或本地截图。需要公开视觉验收结果时，先脱敏并移动到文档资产目录。
