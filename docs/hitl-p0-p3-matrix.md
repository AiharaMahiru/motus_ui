# Motus HITL P0-P3 改造矩阵

## 目标

围绕当前项目已经具备的 HITL 主链路，继续补齐与 Motus 官方语义之间的缺口，优先修复“官方语义不一致、前端误导、状态不可恢复”这类会直接影响使用正确性的点，再补协议兼容、统一抽象和周边能力。

官方对照：

- HITL 指南：<https://docs.motus.lithosai.com/guides/human-in-the-loop>
- Sessions API：<https://docs.motus.lithosai.com/reference/api/sessions>
- Messages API：<https://docs.motus.lithosai.com/reference/api/messages>
- Serve 概览：<https://docs.motus.lithosai.com/reference/cli/serve/overview>

## P0：状态机与恢复语义对齐

状态：已完成

- `ask_user_question` 恢复值改为官方推荐的 `value.answers` 映射。
- WebUI 从“单 interrupt 卡片”升级为“多 interrupt 列表”，同一 interrupt 内支持多问题输入与选项回答。
- SSE 与前端状态同步改为完整 `interrupts` 列表，而不是只透传第一个。
- 服务重启后被降级为 `error` 的 HITL 会话，不再显示可恢复审批卡，避免假恢复。

### P0 验收

- `user_input` interrupt 的 resume 请求体为 `{"value":{"answers":{...}}}`。
- 同一 turn 内两个 pending interrupt 都能显示、分别提交。
- 重启后的 `error` 会话不会再出现可点击的恢复入口。

## P1：协议兼容与感知能力补齐

状态：已完成

- 统一 API 的 `GET /api/sessions/{id}` 支持 `wait=true` 与 `timeout`。
- 统一消息入口补齐更接近 Motus `ChatMessage` 的请求体解析，不再只认 `content`。
- HITL 会话补标题链路，避免长期只显示 ID。
- WebUI 对外部发生的 `interrupted` / `running` / `idle` 切换保持稳定轮询感知。

### P1 验收

- `wait=true` 可在运行中长轮询直到状态变化。
- 缺标题的 HITL 会话会自动回填简短标题。
- 其他客户端打断当前会话后，当前 WebUI 页面可自动看到新状态。

## P2：统一 backend 抽象

状态：已完成

- `/api/workflows*` 改为统一走 `SessionBackend` 抽象。
- `/api/tracing` 与 session/workflow tracing 统一走 `SessionBackend` 抽象。
- `HitlSessionBackend` 补齐 workflow / tracing 能力，至少做到统一入口可用、行为一致。

### P2 验收

- `APP_BACKEND_MODE=hitl` 时，workflow 与 tracing 不再绕开 backend 抽象。
- 本地 backend 与 HITL backend 都能通过同一 router 正常返回 workflow / tracing 数据。

## P3：HITL 周边能力补齐

状态：已完成

- HITL backend 支持附件上传，将附件转换为兼容 Motus `ChatMessage` 的 `user_params` / 图片载荷。
- HITL backend 支持消息级删除；仅允许在非运行态下执行，并同步保持侧车配置。
- 补充对应 smoke test 与文档记录。

### P3 验收

- HITL 模式下上传图片/文件后可进入 agent turn。
- HITL 模式下删除单条或多条消息后，历史与持久化状态一致。

## 实施顺序

1. 先做 P0，避免继续在错误语义上追加功能。
2. 再做 P1，把协议与感知补齐，减少 WebUI 与 backend 的状态偏差。
3. 然后做 P2，统一抽象，避免后续 UI 接入继续绕后门。
4. 最后做 P3，补齐附件与删除等周边能力。
5. 每完成一个优先级节点，立即执行对应 smoke test，并把结果记录到单独文档。
