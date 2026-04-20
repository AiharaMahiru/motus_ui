# 真实 HITL WebUI 联调结果

- 生成时间：`2026-04-19T07:34:01.726664+00:00`
- 通过：`1`
- 失败：`0`
- 跳过：`0`

## 结果明细

### 真实 HITL WebUI 联调

- 状态：`passed`
- 摘要：真实 HITL WebUI user_input / approval 页面闭环通过
- 开始：`2026-04-19T07:33:34.043654+00:00`
- 结束：`2026-04-19T07:33:59.227754+00:00`
- 耗时：`25.18s`
- 现象：
  - api_base_url=http://127.0.0.1:27831
  - hitl_base_url=http://127.0.0.1:63857
  - web_base_url=http://127.0.0.1:43409
  - resolved_model=gpt-5.4-mini
  - gpt-5.4-mini=ok:'OK'
  - returncode=0
  - stdout_tail=Running 2 tests using 1 worker

  ✓  1 [chromium] › tests/e2e/hitl-real.spec.ts:17:3 › real HITL webui › can complete a real user_input interrupt from webui (7.7s)
  ✓  2 [chromium] › tests/e2e/hitl-real.spec.ts:47:3 › real HITL webui › can complete a real tool approval interrupt from webui (6.4s)

  2 passed (15.0s)
  - stderr_tail=(node:361479) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:361479) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
- 产物：
  - `/opt/Agent/runtime/smoke/logs/smoke_real_hitl_webui_server.stdout.log`
  - `/opt/Agent/runtime/smoke/logs/smoke_real_hitl_webui_server.stderr.log`
  - `/opt/Agent/runtime/smoke/logs/smoke_real_hitl_webui_api_server.stdout.log`
  - `/opt/Agent/runtime/smoke/logs/smoke_real_hitl_webui_api_server.stderr.log`
  - `/opt/Agent/runtime/smoke/logs/smoke_real_hitl_webui_vite_server.stdout.log`
  - `/opt/Agent/runtime/smoke/logs/smoke_real_hitl_webui_vite_server.stderr.log`
  - `/opt/Agent/web/test-results`

## 原始 JSON

```json
[
  {
    "name": "真实 HITL WebUI 联调",
    "status": "passed",
    "summary": "真实 HITL WebUI user_input / approval 页面闭环通过",
    "started_at": "2026-04-19T07:33:34.043654+00:00",
    "finished_at": "2026-04-19T07:33:59.227754+00:00",
    "duration_seconds": 25.1841,
    "details": [
      "api_base_url=http://127.0.0.1:27831",
      "hitl_base_url=http://127.0.0.1:63857",
      "web_base_url=http://127.0.0.1:43409",
      "resolved_model=gpt-5.4-mini",
      "gpt-5.4-mini=ok:'OK'",
      "returncode=0",
      "stdout_tail=Running 2 tests using 1 worker\n\n  ✓  1 [chromium] › tests/e2e/hitl-real.spec.ts:17:3 › real HITL webui › can complete a real user_input interrupt from webui (7.7s)\n  ✓  2 [chromium] › tests/e2e/hitl-real.spec.ts:47:3 › real HITL webui › can complete a real tool approval interrupt from webui (6.4s)\n\n  2 passed (15.0s)",
      "stderr_tail=(node:361479) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.\n(Use `node --trace-warnings ...` to show where the warning was created)\n(node:361479) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.\n(Use `node --trace-warnings ...` to show where the warning was created)"
    ],
    "artifacts": [
      "/opt/Agent/runtime/smoke/logs/smoke_real_hitl_webui_server.stdout.log",
      "/opt/Agent/runtime/smoke/logs/smoke_real_hitl_webui_server.stderr.log",
      "/opt/Agent/runtime/smoke/logs/smoke_real_hitl_webui_api_server.stdout.log",
      "/opt/Agent/runtime/smoke/logs/smoke_real_hitl_webui_api_server.stderr.log",
      "/opt/Agent/runtime/smoke/logs/smoke_real_hitl_webui_vite_server.stdout.log",
      "/opt/Agent/runtime/smoke/logs/smoke_real_hitl_webui_vite_server.stderr.log",
      "/opt/Agent/web/test-results"
    ],
    "error": null
  }
]
```
