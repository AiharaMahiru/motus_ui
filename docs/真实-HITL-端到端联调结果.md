# 真实 HITL 端到端联调结果

- 生成时间：`2026-04-19T14:03:59.009786+00:00`
- 通过：`3`
- 失败：`0`
- 跳过：`0`

## 结果明细

### 真实 HITL 服务启动

- 状态：`passed`
- 摘要：统一 API 与独立 HITL server 已联通
- 开始：`2026-04-19T14:03:39.371333+00:00`
- 结束：`2026-04-19T14:03:44.250249+00:00`
- 耗时：`4.88s`
- 现象：
  - api_base_url=http://127.0.0.1:17039
  - hitl_base_url=http://127.0.0.1:55087
  - meta.backend_mode=hitl
  - meta.supports_interrupts=True
  - health={'status': 'ok', 'sessions': 10}
  - resolved_model=gpt-5.4-mini
  - gpt-5.4-mini=ok:'OK'
- 产物：
  - `/opt/Agent/runtime/smoke/logs/smoke_real_hitl_api_server.stdout.log`
  - `/opt/Agent/runtime/smoke/logs/smoke_real_hitl_api_server.stderr.log`
  - `/opt/Agent/runtime/smoke/logs/smoke_real_hitl_server.stdout.log`
  - `/opt/Agent/runtime/smoke/logs/smoke_real_hitl_server.stderr.log`

### 真实 HITL 用户输入联调

- 状态：`passed`
- 摘要：真实 user_input interrupt -> resume -> idle 流程通过
- 开始：`2026-04-19T14:03:44.250285+00:00`
- 结束：`2026-04-19T14:03:52.442303+00:00`
- 耗时：`8.19s`
- 现象：
  - base_url=http://127.0.0.1:17039
  - session_id=407049d5-c7e4-420c-ac74-2cee4138cc92
  - interrupt_type=user_input
  - final_status=idle
  - assistant_content='REAL_HITL_USER_INPUT_OK_bbbd371b'
  - total_usage={'prompt_tokens': 1402, 'completion_tokens': 102, 'total_tokens': 1504}
  - total_cost_usd=0.0007240000000000001
- 产物：
  - `/opt/Agent/runtime/traces/sessions/407049d5-c7e4-420c-ac74-2cee4138cc92`

### 真实 HITL 审批联调

- 状态：`passed`
- 摘要：真实 approval interrupt -> resume -> idle 流程通过
- 开始：`2026-04-19T14:03:52.442354+00:00`
- 结束：`2026-04-19T14:03:58.580532+00:00`
- 耗时：`6.14s`
- 现象：
  - base_url=http://127.0.0.1:17039
  - session_id=210380b3-fd80-48df-ba6d-b3100a6ae389
  - interrupt_type=tool_approval
  - final_status=idle
  - assistant_content='已完成联调，REAL_HITL_APPROVAL_OK_c2c18d83'
  - total_usage={'prompt_tokens': 932, 'completion_tokens': 75, 'total_tokens': 1007}
  - total_cost_usd=0.0004928
- 产物：
  - `/opt/Agent/runtime/traces/sessions/210380b3-fd80-48df-ba6d-b3100a6ae389`

## 原始 JSON

```json
[
  {
    "name": "真实 HITL 服务启动",
    "status": "passed",
    "summary": "统一 API 与独立 HITL server 已联通",
    "started_at": "2026-04-19T14:03:39.371333+00:00",
    "finished_at": "2026-04-19T14:03:44.250249+00:00",
    "duration_seconds": 4.878916,
    "details": [
      "api_base_url=http://127.0.0.1:17039",
      "hitl_base_url=http://127.0.0.1:55087",
      "meta.backend_mode=hitl",
      "meta.supports_interrupts=True",
      "health={'status': 'ok', 'sessions': 10}",
      "resolved_model=gpt-5.4-mini",
      "gpt-5.4-mini=ok:'OK'"
    ],
    "artifacts": [
      "/opt/Agent/runtime/smoke/logs/smoke_real_hitl_api_server.stdout.log",
      "/opt/Agent/runtime/smoke/logs/smoke_real_hitl_api_server.stderr.log",
      "/opt/Agent/runtime/smoke/logs/smoke_real_hitl_server.stdout.log",
      "/opt/Agent/runtime/smoke/logs/smoke_real_hitl_server.stderr.log"
    ],
    "error": null
  },
  {
    "name": "真实 HITL 用户输入联调",
    "status": "passed",
    "summary": "真实 user_input interrupt -> resume -> idle 流程通过",
    "started_at": "2026-04-19T14:03:44.250285+00:00",
    "finished_at": "2026-04-19T14:03:52.442303+00:00",
    "duration_seconds": 8.192018,
    "details": [
      "base_url=http://127.0.0.1:17039",
      "session_id=407049d5-c7e4-420c-ac74-2cee4138cc92",
      "interrupt_type=user_input",
      "final_status=idle",
      "assistant_content='REAL_HITL_USER_INPUT_OK_bbbd371b'",
      "total_usage={'prompt_tokens': 1402, 'completion_tokens': 102, 'total_tokens': 1504}",
      "total_cost_usd=0.0007240000000000001"
    ],
    "artifacts": [
      "/opt/Agent/runtime/traces/sessions/407049d5-c7e4-420c-ac74-2cee4138cc92"
    ],
    "error": null
  },
  {
    "name": "真实 HITL 审批联调",
    "status": "passed",
    "summary": "真实 approval interrupt -> resume -> idle 流程通过",
    "started_at": "2026-04-19T14:03:52.442354+00:00",
    "finished_at": "2026-04-19T14:03:58.580532+00:00",
    "duration_seconds": 6.138178,
    "details": [
      "base_url=http://127.0.0.1:17039",
      "session_id=210380b3-fd80-48df-ba6d-b3100a6ae389",
      "interrupt_type=tool_approval",
      "final_status=idle",
      "assistant_content='已完成联调，REAL_HITL_APPROVAL_OK_c2c18d83'",
      "total_usage={'prompt_tokens': 932, 'completion_tokens': 75, 'total_tokens': 1007}",
      "total_cost_usd=0.0004928"
    ],
    "artifacts": [
      "/opt/Agent/runtime/traces/sessions/210380b3-fd80-48df-ba6d-b3100a6ae389"
    ],
    "error": null
  }
]
```
