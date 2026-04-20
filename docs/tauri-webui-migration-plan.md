# Tauri WebUI 迁移实施方案

## 摘要

本方案将项目从当前 `TUI + FastAPI` 形态迁移为：

- `Python HTTP 后端`
- `React + Vite + TypeScript` 前端
- `Tauri` 桌面壳
- `Nuitka` 打包的 Python sidecar

WebUI 优先阶段的细化执行计划，见：`docs/webui-开发计划.md`

本次已经确认的关键决策如下：

- 前端：`React + Vite + TypeScript`
- 桌面壳：`Tauri`
- Python 封装：`Nuitka`
- 运行时目录：继续使用项目内 `runtime/`

迁移的核心原则是：

- 不重写现有后端服务层
- UI 继续只通过 `/api/*` 和 SSE 与后端通信
- 先完成 Web UI 与 Tauri 壳，再移除 TUI

## 实施变更

### 1. 后端整理为可桌面分发的稳定服务

- 保留现有 `FastAPI`、`/api/*`、SSE、workflow、tracing、session 恢复逻辑，不重写服务层。
- 新增统一的桌面运行配置层，集中管理监听地址、端口、runtime 根目录、日志路径，不允许入口自行拼装。
- 后端入口拆成两种模式：
  - 开发模式：本地直接 `uv run agent-server`
  - 桌面模式：由 Tauri 启动 Nuitka 打包后的 sidecar，并传入端口和运行参数
- 为桌面前端补一个轻量元信息接口，返回当前 API base URL、runtime 根目录、版本号、桌面模式标识，避免前端猜测环境。
- 保持现有会话 API 契约不变；如需新增接口，仅补充元信息和桌面启动自检，不改现有聊天协议。

### 2. 新建 Web 前端并对接现有后端

- 新增 `web/`，采用 feature-first 结构：
  - `features/sessions`
  - `features/chat`
  - `features/config`
  - `features/workflows`
  - `features/tracing`
  - `shared/ui`
  - `lib/api`
  - `lib/stream`
- API 客户端统一封装：
  - 普通请求：`fetch + typed wrapper`
  - 会话数据：`TanStack Query`
  - 流式回复：自定义 `fetch` SSE 解析器
- 首批页面与区域包括：
  - 会话列表
  - 主对话区
  - 会话配置面板
  - metrics / cost 面板
  - workflow / tracing 侧栏
- Web UI 直接复用现有 `assistant.step / assistant.final / session.error / done` 事件，不读取后端内部对象。
- UI 风格按桌面应用工作台设计，而不是浏览器站点设计：三栏工作区、紧凑信息密度、明确状态层级。

### 3. 接入 Tauri 作为桌面壳

- 新增 `desktop/tauri/`，由 Tauri 负责：
  - 启动 Python sidecar
  - 检测后端就绪
  - 将 API 地址注入前端
  - 管理窗口、菜单、图标、版本信息
- Python sidecar 使用 Nuitka 打包为平台对应可执行文件，并按 Tauri sidecar 方式随应用发布。
- Tauri 与前端之间只负责启动编排和环境注入；业务通信仍走本地 `HTTP + SSE`，不改成 Tauri command 模式。
- 桌面开发模式采用双进程联调：
  - Vite dev server
  - 本地 Python server
- 桌面发布模式采用单体应用：
  - Tauri 前端静态资源
  - 内置 Python sidecar
  - 本地监听回环地址

### 4. 移除 TUI

- 在 Web UI 与 Tauri 壳完成并通过 smoke 后，删除：
  - `core/ui/`
  - `apps/tui.py`
  - `agent-tui` 脚本
  - `textual` 依赖
  - TUI smoke 与相关截图产物检查
- README、开发文档、运行说明、系统 smoke 文档全部改写为：
  - `agent-server`
  - `web/` 开发模式
  - `Tauri` 桌面模式
- 保留后端抽象边界不变：UI 只认 `core.schemas` 和 `/api/*`，不直接耦合 server 内部实现。

## 接口与契约

现有接口继续保留：

- `POST /api/sessions`
- `GET /api/sessions`
- `GET /api/sessions/{id}`
- `GET /api/sessions/{id}/messages`
- `POST /api/sessions/{id}/messages`
- `POST /api/sessions/{id}/messages/stream`
- workflow 与 tracing 全部现有接口

新增建议接口：

- `GET /api/meta`

返回字段约定：

- `app_version`
- `desktop_mode`
- `api_base_url`
- `runtime_dir`
- `server_started_at`

约束如下：

- 现有 SSE 事件名和 payload 结构保持兼容
- 前端据此构建消息流与步骤流
- `runtime/` 继续作为统一运行目录
- 桌面模式下仍写项目内 `runtime/`，实现上需保证路径解析稳定且可覆盖

## 测试与验收

### 后端

- 现有 smoke 全部保留，但移除 TUI 用例。
- 新增桌面模式自检：
  - sidecar 可启动
  - `/health` 正常
  - `/api/meta` 返回桌面模式信息
- 验证 session 恢复、SSE、workflow、tracing 在桌面模式与开发模式下一致。

### Web 前端

- 无头前端 smoke 至少覆盖：
  - 页面可加载
  - 历史会话列表可见
  - 新建会话成功
  - 发送消息成功
  - 流式中间步骤可显示
  - `assistant.final` 可落到消息流
- 增加接口契约测试，确保前端对 `/api/*` 和 SSE payload 的解析稳定。

### Tauri

- 开发模式验收：
  - 前端能连接本地 Python
  - 窗口打开时自动健康检查
- 打包模式验收：
  - Tauri 成功启动 sidecar
  - sidecar 监听端口可达
  - 聊天、workflow、tracing 全部可用
  - 关闭应用时 sidecar 正常退出

## 假设与默认值

- 当前阶段按本地单用户桌面应用设计，不引入账号体系和远程认证。
- 不迁移 runtime 到系统 AppData，继续使用项目内 `runtime/`。
- Web 前端目标是“可浏览器运行，也可直接装入 Tauri”，因此不引入 SSR / Next.js 架构。
- Python 打包优先采用 Nuitka 产物，不保留解释器 + venv 作为正式发布方案。
