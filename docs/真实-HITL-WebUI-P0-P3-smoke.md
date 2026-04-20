# 真实 HITL WebUI P0-P3 Smoke 记录

## P0

- `cd web && npm exec vitest run src/features/sessions/constants.test.ts src/features/chat/components/InterruptResumeCard.test.tsx`
  - 结果：7 个测试全部通过
  - 覆盖点：
    - HITL 预设草稿
    - `ask_user_question` 安全过滤
    - `tool_approval` / `approval` 卡片分支

## P1

- `uv run python -m scripts.smoke.hitl_real_webui`
  - 结果：通过
  - 覆盖点：
    - WebUI 真实 `user_input interrupt -> resume -> idle`
    - WebUI 真实 `tool_approval interrupt -> resume -> idle`
    - 页面最终回复包含专用 token

## P2

- 产物文档：
  - `docs/真实-HITL-WebUI-联调结果.md`
- 运行日志：
  - `runtime/smoke/logs/smoke_real_hitl_webui_server.*`
  - `runtime/smoke/logs/smoke_real_hitl_webui_api_server.*`
  - `runtime/smoke/logs/smoke_real_hitl_webui_vite_server.*`
- Playwright 产物：
  - `web/test-results`

## P3

- `SMOKE_INCLUDE_REAL_HITL_WEBUI=1 uv run python -m scripts.smoke.run_all`
  - 结果：通过
  - 说明：真实 HITL WebUI 已作为可选系统级 smoke 接入，不会默认消耗真实模型费用。

## 回归补充

- `cd web && npm run build`
  - 结果：通过
- `uv run python -m py_compile scripts/smoke/hitl_real_support.py scripts/smoke/hitl_real_webui.py scripts/smoke/run_all.py`
  - 结果：通过
