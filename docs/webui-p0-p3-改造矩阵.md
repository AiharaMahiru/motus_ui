# WebUI P0-P3 改造矩阵

## 目标

围绕 `主题 / i18n / 性能 / 体验控制` 四条主线，对当前 WebUI 做一次可持续演进的系统休整，避免继续在页面级硬编码和高频重渲染上累积技术债。

## 矩阵

| 阶段 | 状态 | 目标 | 范围 | 产出 | Smoke |
| --- | --- | --- | --- | --- | --- |
| P0 | 已完成 | 建立基础设施 | 主题上下文、语言上下文、全局格式化 locale、偏好持久化 | `ThemeProvider`、`I18nProvider`、基础 token、偏好状态持久化 | `npm run build` 通过 |
| P1 | 已完成 | 接入核心界面 | 顶栏、会话区、工作流区、右侧栏、预览区主要文案与主题适配 | 浅色 / 深色 / 黑色三主题可切换；中文 / 英文双语可切换 | 关键组件 smoke 通过 |
| P2 | 已完成 | 性能止血 | 查询轮询、工具摘要请求、预览轮询、localStorage 写入节流 | 降低无效请求与高频状态抖动，减少长会话卡顿 | `vitest` 定向用例通过 |
| P3 | 已完成 | 体验打磨 | 顶栏控制入口、图表/终端/Markdown 子渲染器主题联动、细节一致性 | 偏好入口统一、子渲染器随主题变更、整体视觉一致 | 最终 build 通过 |

## 风险点

- 当前大量 JSX 直接写死 `bg-white / text-slate-* / border-slate-*`，主题切换不能只改根变量。
- 当前文案高度分散，i18n 需要优先覆盖高频主路径，再补齐高级面板。
- 图表、Mermaid、终端预览都属于“子渲染器”，必须单独适配，不然会出现壳体切了主题、内容没切的割裂感。
- 长会话性能瓶颈不只在 DOM，还在轮询、工具摘要请求和本地持久化频率。

## 验收口径

- 主题支持 `light / dark / black`，并持久化到本地。
- 语言支持 `zh-CN / en-US`，并覆盖工作台主路径。
- 聊天、工作流、预览三条主链路在构建与基础交互上可用。
- 不引入新的明显 UI 闪烁、阻塞和高频网络噪音。

## 实际完成项

- 新增主题与语言上下文，并接入 `AppProviders`。
- 顶栏增加主题 / 语言切换入口，偏好会持久化。
- 全局时间、数字、货币格式化改为 locale-aware。
- 会话区、工作流区、右侧栏、资源条、预览区等主路径完成中英双语接入。
- Mermaid、结构化图表、终端预览完成主题联动。
- 会话查询轮询策略、工具摘要请求、预览轮询和步骤落盘频率做了收敛。

## 本轮 Smoke

- `cd web && npm run build`
- `cd web && npx vitest run src/features/sessions/components/SessionSidebar.test.tsx src/features/chat/components/ComposerConfigBar.test.tsx src/features/chat/components/ResourceTelemetryBar.test.tsx src/features/previews/components/PreviewDock.test.tsx`
- 说明：
  - `vitest` 过程中有 `HTMLCanvasElement.getContext` 的 jsdom 提示，但目标用例全部通过。
  - 构建仍有大 chunk 告警，主要集中在结构化图表与预览相关包，这是后续继续压包体的优化项，不影响本轮功能完成。
