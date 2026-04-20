# WebUI P0-P3 TODO

## P0 基础设施

- [x] 新增主题上下文，支持 `light / dark / black`
- [x] 新增语言上下文，支持 `zh-CN / en-US`
- [x] 将全局时间、数字、货币格式化改为 locale-aware
- [x] 增加主题/语言偏好本地持久化

## P1 主界面接入

- [x] 顶栏接入主题与语言切换入口
- [x] 会话页主路径接入 i18n
- [x] 工作流页主路径接入 i18n
- [x] 右侧栏与加载页接入主题和 i18n
- [x] 预览区主要文案与主要表面接入主题

## P2 性能优化

- [x] 降低静态查询的重复刷新频率
- [x] 优化会话列表 / 明细 / 消息轮询策略
- [x] 工具摘要请求改为惰性触发
- [x] StepGroup 本地持久化增加节流
- [x] SSE 驱动状态更新收敛，减少主线程抖动

## P3 体验打磨

- [x] Mermaid 随主题切换
- [x] 结构化图表随主题切换
- [x] 终端预览随主题切换
- [x] 顶栏偏好入口视觉统一
- [x] 宽屏 / 窄屏做一轮回归检查

## Smoke

- [x] `cd web && npm run build`
- [x] 聊天页：主题切换
- [x] 聊天页：语言切换
- [x] 工作流页：主题切换
- [x] 工作流页：语言切换
- [x] 预览区：主题联动

## 结果备注

- 关键 smoke 已通过：`build`、`SessionSidebar`、`ComposerConfigBar`、`ResourceTelemetryBar`、`PreviewDock`
- `vitest` 运行时存在 jsdom 对 canvas 的提示，但本轮目标测试全部通过
- 当前仍有大 chunk 告警，属于后续继续拆包优化项
