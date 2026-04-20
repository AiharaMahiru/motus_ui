# HITL P0-P3 Smoke 记录

## P0

- `uv run python -m unittest tests.test_hitl_backend tests.test_hitl_server_recovery tests.test_api_session_backend tests.test_hitl_state`
  - 结果：14 个测试全部通过
  - 覆盖点：
    - `value.answers` 恢复语义
    - 多 interrupt SSE 载荷
    - 重启后 `error` 会话不再暴露可恢复 interrupt
    - `wait=true` 路由透传
- `cd web && npm exec vitest run src/shared/stream/sse.test.ts src/features/chat/components/InterruptResumeCard.test.tsx`
  - 结果：6 个测试全部通过
  - 覆盖点：
    - `session.interrupted.interrupts[]` 解析
    - 多问题 interrupt 卡片提交 `answers` 映射
    - approval interrupt 提交

## P1

- `uv run python -m unittest tests.test_hitl_backend tests.test_api_session_backend`
  - 结果：8 个测试全部通过
  - 覆盖点：
    - HITL 会话标题自动回填
    - `GET /api/sessions/{id}?wait=true&timeout=...`
    - 扩展消息字段透传
    - `POST /api/sessions/{id}/messages?wait=false` 返回 202

## P2

- `uv run python -m unittest tests.test_api_session_backend tests.test_workflow_service tests.test_system_service`
  - 结果：11 个测试全部通过
  - 覆盖点：
    - `/api/workflows*` 统一走 backend 抽象
    - `/api/tracing` 统一走 backend 抽象
    - workflow / tracing 既有本地能力未回退

## P3

- `uv run python -m unittest tests.test_hitl_backend`
  - 结果：6 个测试全部通过
  - 覆盖点：
    - HITL 附件转 `user_params.attachments/images`
    - HITL 消息级删除后会话重建
    - 配置保留与历史一致性

## 回归补充

- `uv run python -m py_compile $(rg --files apps core tests | rg '\.py$')`
  - 结果：通过
- `uv run python -m unittest tests.test_hitl_backend tests.test_api_session_backend tests.test_hitl_server_recovery tests.test_hitl_state tests.test_workflow_service tests.test_system_service`
  - 结果：27 个测试全部通过
- `cd web && npm exec vitest run src/shared/stream/sse.test.ts src/features/chat/components/InterruptResumeCard.test.tsx src/shared/api/contracts.test.ts`
  - 结果：9 个测试全部通过
- `cd web && npm run build`
  - 结果：通过
  - 备注：Vite 仍提示少量大 chunk 警告，但构建成功，不影响本轮 HITL 改造功能正确性
