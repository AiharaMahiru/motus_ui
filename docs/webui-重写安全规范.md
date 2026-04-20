# WebUI 重写安全规范

## 文档目的

这份文档是写给“下一位接手重写 `web/` 的 LLM / 工程师”的。

目标不是限制重写，而是确保：

- 可以大胆重写视觉和前端结构
- 不能写坏现有后端契约
- 不能写坏自动化测试与 smoke
- 不能把运行目录、环境变量、流式事件、会话恢复链路弄乱

一句话原则：

**可以重写 WebUI 的外观和前端实现，但不能重写后端协议。**

---

## 重写范围

### 允许重写

以下内容可以大改，甚至整体替换：

- `web/src/index.css`
- `web/src/App.tsx`
- `web/src/app/*`
- `web/src/features/*`
- `web/src/shared/*`
- `web/tests/e2e/*`
- `web/playwright.config.ts`
- `web/vitest.config.ts`

说明：

- 组件结构、样式体系、布局方案、视觉风格都可以重做
- 可以从 CSS 改成 Tailwind，或者反过来
- 可以替换组件拆分方式
- 可以重写状态管理，只要行为不变

### 不建议改

以下内容只有在“确实被前端重写阻塞”时才允许改，且改动后必须重新跑全量验证：

- `core/servers/api.py`
- `core/schemas/*.py`
- `core/chat/service.py`
- `core/services/tracing.py`
- `core/workflows/service.py`
- `scripts/smoke/*.py`

说明：

- 这些文件属于协议层和回归基线
- 如果 UI 难看，不是后端的问题，不要用改接口来逃避前端实现难度

### 禁止改坏

这些行为禁止破坏：

- `/api/*` 路径和响应结构
- SSE 事件名与核心 payload 字段
- `.env` 从项目根读取这一约束
- `runtime/` 作为统一运行目录
- 会话恢复能力
- `npm run build / test / e2e`
- `uv run python -m scripts.smoke.run_all`

---

## 后端契约

权威入口：

- [api.py](/opt/Agent/core/servers/api.py)
- [session.py](/opt/Agent/core/schemas/session.py)
- [workflow.py](/opt/Agent/core/schemas/workflow.py)
- [tracing.py](/opt/Agent/core/schemas/tracing.py)
- [meta.py](/opt/Agent/core/schemas/meta.py)
- [runtime.py](/opt/Agent/core/schemas/runtime.py)

### 必须兼容的 HTTP 接口

- `GET /health`
- `GET /api/meta`
- `GET /api/runtime/requirements`
- `POST /api/sessions`
- `GET /api/sessions`
- `GET /api/sessions/{session_id}`
- `GET /api/sessions/{session_id}/messages`
- `DELETE /api/sessions/{session_id}`
- `POST /api/sessions/{session_id}/messages`
- `POST /api/sessions/{session_id}/messages/stream`
- `GET /api/sessions/{session_id}/tracing`
- `POST /api/sessions/{session_id}/tracing/export`
- `GET /api/workflows`
- `GET /api/workflows/runs`
- `POST /api/workflows/runs`
- `GET /api/workflows/runs/{run_id}`
- `GET /api/workflows/runs/{run_id}/tracing`
- `POST /api/workflows/runs/{run_id}/tracing/export`
- `GET /api/tracing`
- `POST /api/tracing/export`

### SSE 契约

当前聊天流是：

- `POST /api/sessions/{session_id}/messages/stream`

这意味着：

- **不能用原生 `EventSource`**
- 必须继续使用 `fetch + ReadableStream` 解析

必须兼容的事件名：

- `session.started`
- `assistant.step`
- `assistant.final`
- `session.error`
- `done`

关键字段：

- `session.started`
  - `session_id`
  - `content`
  - `timestamp`
- `assistant.step`
  - `session_id`
  - `agent_name`
  - `content`
  - `tool_calls`
  - `timestamp`
- `assistant.final`
  - `session_id`
  - `assistant`
  - `metrics`
  - `timestamp`
- `session.error`
  - `session_id`
  - `message`
  - `timestamp`
- `done`
  - `session_id`
  - `timestamp`

不要改：

- 事件名
- `assistant.final.metrics` 的结构
- `assistant.step.tool_calls` 的含义

---

## 前端必须保留的能力

重写后至少保留这些功能：

### 会话

- 会话列表加载
- 新建会话
- 删除会话
- 会话搜索
- 会话详情读取
- 历史消息读取

### 聊天

- 发送消息
- 流式中间状态展示
- `assistant.final` 落盘到消息流
- `session.error` 展示
- 重复发送保护

### 配置

- `title`
- `system_prompt`
- `model_name`
- `pricing_model`
- `max_steps`
- `timeout_seconds`
- `thinking.enabled`
- `thinking.effort`
- `thinking.verbosity`
- `thinking.budget_tokens`
- `enabled_tools`
- `mcp_servers`
- `multi_agent`

### Workflow / Tracing / Runtime

- workflow 列表
- workflow run 启动
- workflow run 详情轮询
- session tracing 状态与导出
- workflow tracing 状态与导出
- runtime requirements 面板
- meta 面板

---

## 环境与运行约束

### 环境变量

统一从项目根 `.env` 读取：

- [env.py](/opt/Agent/core/config/env.py)

不要：

- 在 `web/` 下新建另一份 `.env`
- 把 key 写进前端源码
- 在前端硬编码 API 密钥

### 运行目录

统一使用：

- [paths.py](/opt/Agent/core/config/paths.py)

不要：

- 改 `runtime/` 位置
- 改会话、trace、smoke 的输出目录结构

### 代理与开发模式

当前前端联调依赖：

- [vite.config.ts](/opt/Agent/web/vite.config.ts)

要求：

- 前端开发代理仍能把 `/api/*` 和 `/health` 转到 Python server
- `playwright.config.ts` 仍能自动拉起 Python server 和前端 dev server，或等效替代

---

## 视觉重写建议

用户已经明确表示：

- 当前 WebUI 视觉仍不满意
- 允许重新写一版
- 但不接受把功能链路写坏

因此推荐做法是：

### 可以重做

- 顶部 Header
- 三栏工作台布局
- 会话卡片样式
- 聊天气泡样式
- 步骤卡片形式
- 右侧配置区信息层级
- Workflow 页整体视觉

### 但必须满足

- 桌面端首屏稳定，不要整页被某一栏撑爆
- 左右栏内部滚动，中间主工作区独立滚动
- 消息气泡高度随内容走，不要固定成大空盒
- 长 JSON / 长输出要有独立滚动容器
- 步骤卡片默认折叠或紧凑显示，不能吞掉聊天区
- 窄屏时必须能降级为单列或分段布局

### 不要做的事

- 不要为了好看删掉配置能力
- 不要把 `mcp` / `multi_agent` / `runtime` / `tracing` 面板“暂时移除”
- 不要把真实数据改成 mock
- 不要把流式步骤改成假 loading 动画
- 不要直接去掉测试选择器，除非同步更新测试

---

## 测试与回归要求

权威测试入口：

- [playwright.config.ts](/opt/Agent/web/playwright.config.ts)
- [chat.spec.ts](/opt/Agent/web/tests/e2e/chat.spec.ts)
- [workflow.spec.ts](/opt/Agent/web/tests/e2e/workflow.spec.ts)
- [webui.py](/opt/Agent/scripts/smoke/webui.py)
- [run_all.py](/opt/Agent/scripts/smoke/run_all.py)

### 你提交前必须跑

```bash
cd /opt/Agent/web && npm run build
cd /opt/Agent/web && npm run test
cd /opt/Agent/web && npm run e2e
cd /opt/Agent && uv run python -m scripts.smoke.webui
cd /opt/Agent && uv run python -m scripts.smoke.run_all
```

### 必须通过的标准

- `npm run build` 通过
- `npm run test` 通过
- `npm run e2e` 通过
- `scripts.smoke.webui` 通过
- `scripts.smoke.run_all` 不新增失败

如果你改了测试：

- 必须说明为什么原测试不再合理
- 必须证明新测试仍覆盖：
  - 聊天真实流式链路
  - workflow 真实链路
  - WebUI 能被 smoke 驱动

---

## 当前前端结构建议

可参考但不强绑：

```text
web/src/
  app/
  features/
    chat/
    meta/
    runtime/
    sessions/
    tracing/
    workflows/
  shared/
    api/
    lib/
    stream/
```

如果你要重组目录：

- 可以改
- 但测试、导入路径、Playwright、smoke 要一起改完

---

## 已知高风险点

### 1. 把 SSE 改成 EventSource

会坏，因为当前是 `POST` 流。

### 2. 为了 UI 简化而改后端响应结构

会坏，因为 smoke、tests、其他 UI 平台都依赖这套契约。

### 3. 在前端硬编码端口 / 地址

会坏，因为 Playwright、外网测试、桌面模式都会受影响。

### 4. 为了“看起来整洁”而删掉高级配置

会坏，因为当前会话配置不是装饰，而是真实能力入口。

### 5. 不跑 `run_all`

会漏掉：

- Python 端 smoke
- HTTP API smoke
- WebUI smoke
- 现有 TUI / HITL 基线是否被连带打坏

---

## 推荐执行方式

如果你是下一位接手重写的模型，建议按这个顺序做：

1. 先读：
   - [api.py](/opt/Agent/core/servers/api.py)
   - [contracts.ts](/opt/Agent/web/src/shared/api/contracts.ts)
   - [sse.ts](/opt/Agent/web/src/shared/stream/sse.ts)
   - [playwright.config.ts](/opt/Agent/web/playwright.config.ts)
2. 先跑现有：
   - `npm run build`
   - `npm run test`
   - `npm run e2e`
3. 再开始重写 `web/src/`
4. 每完成一个大块就跑：
   - `npm run build`
   - `npm run test`
5. 完成后再跑：
   - `npm run e2e`
   - `uv run python -m scripts.smoke.webui`
   - `uv run python -m scripts.smoke.run_all`

---

## 可直接复制给其他 LLM 的提示

下面这段可以直接复制给接手的模型：

```text
你现在只负责重写 /opt/Agent/web 的 WebUI。

硬约束：
1. 不要改坏 /api/* 和 SSE 契约
2. 不要把 POST 流式接口改成 EventSource
3. 不要改 runtime/、.env 读取方式、会话恢复机制
4. 不要删除会话配置、workflow、tracing、runtime requirements、meta 能力
5. 你可以重写 web/src/**、web/tests/**、web/playwright.config.ts，但必须保持功能完整
6. 最终必须通过：
   - cd /opt/Agent/web && npm run build
   - cd /opt/Agent/web && npm run test
   - cd /opt/Agent/web && npm run e2e
   - cd /opt/Agent && uv run python -m scripts.smoke.webui
   - cd /opt/Agent && uv run python -m scripts.smoke.run_all

先读这些文件：
- /opt/Agent/core/servers/api.py
- /opt/Agent/web/src/shared/api/contracts.ts
- /opt/Agent/web/src/shared/stream/sse.ts
- /opt/Agent/web/playwright.config.ts
- /opt/Agent/scripts/smoke/webui.py

目标：
- 允许完全重做视觉
- 但不能写坏真实数据链路和回归测试
- 桌面端必须稳定坐在一页内，左右栏内部滚动
- 消息气泡高度跟内容走
- 长 JSON/长输出必须内部滚动
```

---

## 最终交付标准

只有同时满足下面这些条件，才算“重写成功而且没有写坏”：

- 视觉明显提升
- 真实后端链路保持可用
- 所有核心面板仍存在
- 桌面端布局稳定
- 自动化测试通过
- 系统 smoke 通过

如果只满足“更好看”，但 smoke 挂了，那就是失败。
