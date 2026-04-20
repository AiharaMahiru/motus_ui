# 系统级 Smoke Test 结果

- 生成时间：`2026-04-19T07:35:55.134778+00:00`
- 通过：`13`
- 失败：`0`
- 跳过：`1`

## 结果明细

### 静态与入口校验

- 状态：`passed`
- 摘要：语法编译和入口模块导入通过
- 开始：`2026-04-19T07:34:21.047555+00:00`
- 结束：`2026-04-19T07:34:25.323290+00:00`
- 耗时：`4.28s`
- 现象：
  - py_compile.returncode=0
  - imports.returncode=0
  - imports.stdout='imports-ok'
  - py_compile.stderr=''
  - imports.stderr=''

### 本地普通会话

- 状态：`passed`
- 摘要：本地普通会话完成并导出 session trace
- 开始：`2026-04-19T07:34:27.963938+00:00`
- 结束：`2026-04-19T07:34:31.159359+00:00`
- 耗时：`3.20s`
- 现象：
  - session_id=d0469924-e764-4997-a55a-8c1e4a959bf8
  - assistant='LOCAL_SMOKE_OK_8b382de0'
  - trace_log_dir=/opt/Agent/runtime/traces/sessions/d0469924-e764-4997-a55a-8c1e4a959bf8
  - trace_files=['jaeger_traces.json', 'trace_viewer.html', 'tracer_state.json']
- 产物：
  - `/opt/Agent/runtime/traces/sessions/d0469924-e764-4997-a55a-8c1e4a959bf8`
  - `/opt/Agent/runtime/traces/sessions/d0469924-e764-4997-a55a-8c1e4a959bf8/jaeger_traces.json`
  - `/opt/Agent/runtime/traces/sessions/d0469924-e764-4997-a55a-8c1e4a959bf8/trace_viewer.html`
  - `/opt/Agent/runtime/traces/sessions/d0469924-e764-4997-a55a-8c1e4a959bf8/tracer_state.json`

### 本地多代理会话

- 状态：`passed`
- 摘要：多代理委派成功，专家参与了本地文件读取
- 开始：`2026-04-19T07:34:31.159392+00:00`
- 结束：`2026-04-19T07:34:41.425074+00:00`
- 耗时：`10.27s`
- 现象：
  - session_id=4640e822-6d38-4db6-918d-c041e2913676
  - assistant='CODE=8B63EE37D3'
  - specialist_used=True
  - agent_metrics_count=2
  - trace_log_dir=/opt/Agent/runtime/traces/sessions/4640e822-6d38-4db6-918d-c041e2913676
  - trace_files=['jaeger_traces.json', 'trace_viewer.html', 'tracer_state.json']
- 产物：
  - `/opt/Agent/runtime/smoke/multi_agent_input.txt`
  - `/opt/Agent/runtime/traces/sessions/4640e822-6d38-4db6-918d-c041e2913676`
  - `/opt/Agent/runtime/traces/sessions/4640e822-6d38-4db6-918d-c041e2913676/jaeger_traces.json`
  - `/opt/Agent/runtime/traces/sessions/4640e822-6d38-4db6-918d-c041e2913676/trace_viewer.html`
  - `/opt/Agent/runtime/traces/sessions/4640e822-6d38-4db6-918d-c041e2913676/tracer_state.json`

### Workflow Text Insights

- 状态：`passed`
- 摘要：workflow 运行完成并成功导出 workflow run 级 trace
- 开始：`2026-04-19T07:34:41.430122+00:00`
- 结束：`2026-04-19T07:34:41.495030+00:00`
- 耗时：`0.06s`
- 现象：
  - run_id=605a6892-663c-496f-9cdd-c2f435694aac
  - workflow_status=completed
  - trace_scope=workflow
  - trace_log_dir=/opt/Agent/runtime/traces/workflows/605a6892-663c-496f-9cdd-c2f435694aac
  - trace_files=['jaeger_traces.json', 'trace_viewer.html', 'tracer_state.json']
  - output_keys=['headings', 'keywords', 'preview', 'stats']
- 产物：
  - `/opt/Agent/runtime/traces/workflows/605a6892-663c-496f-9cdd-c2f435694aac`
  - `/opt/Agent/runtime/traces/workflows/605a6892-663c-496f-9cdd-c2f435694aac/jaeger_traces.json`
  - `/opt/Agent/runtime/traces/workflows/605a6892-663c-496f-9cdd-c2f435694aac/trace_viewer.html`
  - `/opt/Agent/runtime/traces/workflows/605a6892-663c-496f-9cdd-c2f435694aac/tracer_state.json`

### HTTP API 健康检查

- 状态：`passed`
- 摘要：HTTP 服务启动成功，health 接口可访问
- 开始：`2026-04-19T07:34:41.495495+00:00`
- 结束：`2026-04-19T07:34:47.365279+00:00`
- 耗时：`5.87s`
- 现象：
  - base_url=http://127.0.0.1:38669
  - health={'status': 'ok', 'sessions': 93}
- 产物：
  - `/opt/Agent/runtime/smoke/logs/smoke_http_api_server.stdout.log`
  - `/opt/Agent/runtime/smoke/logs/smoke_http_api_server.stderr.log`

### HTTP API 会话与流式事件

- 状态：`passed`
- 摘要：会话创建、SSE 流和 session tracing 接口正常
- 开始：`2026-04-19T07:34:47.365304+00:00`
- 结束：`2026-04-19T07:34:50.703220+00:00`
- 耗时：`3.34s`
- 现象：
  - session_id=227a6d2a-b894-4bb5-9107-1484f45c2b71
  - event_names=['session.started', 'assistant.final', 'done']
  - assistant_content='HTTP_STREAM_OK_227a6d2a'
  - trace_log_dir=/opt/Agent/runtime/traces/sessions/227a6d2a-b894-4bb5-9107-1484f45c2b71
  - trace_files=['jaeger_traces.json', 'trace_viewer.html', 'tracer_state.json']
- 产物：
  - `/opt/Agent/runtime/traces/sessions/227a6d2a-b894-4bb5-9107-1484f45c2b71`
  - `/opt/Agent/runtime/traces/sessions/227a6d2a-b894-4bb5-9107-1484f45c2b71/jaeger_traces.json`
  - `/opt/Agent/runtime/traces/sessions/227a6d2a-b894-4bb5-9107-1484f45c2b71/trace_viewer.html`
  - `/opt/Agent/runtime/traces/sessions/227a6d2a-b894-4bb5-9107-1484f45c2b71/tracer_state.json`

### HTTP API Workflow 与 Tracing

- 状态：`passed`
- 摘要：workflow API 与 workflow run tracing 接口正常
- 开始：`2026-04-19T07:34:50.703242+00:00`
- 结束：`2026-04-19T07:34:50.769692+00:00`
- 耗时：`0.07s`
- 现象：
  - run_id=8fcedb69-b508-4b7c-92c5-6955de501c3f
  - workflow_status=completed
  - trace_log_dir=/opt/Agent/runtime/traces/workflows/8fcedb69-b508-4b7c-92c5-6955de501c3f
  - trace_files=['jaeger_traces.json', 'trace_viewer.html', 'tracer_state.json']
- 产物：
  - `/opt/Agent/runtime/traces/workflows/8fcedb69-b508-4b7c-92c5-6955de501c3f`
  - `/opt/Agent/runtime/traces/workflows/8fcedb69-b508-4b7c-92c5-6955de501c3f/jaeger_traces.json`
  - `/opt/Agent/runtime/traces/workflows/8fcedb69-b508-4b7c-92c5-6955de501c3f/trace_viewer.html`
  - `/opt/Agent/runtime/traces/workflows/8fcedb69-b508-4b7c-92c5-6955de501c3f/tracer_state.json`

### WebUI 构建

- 状态：`passed`
- 摘要：WebUI 构建通过
- 开始：`2026-04-19T07:34:50.984627+00:00`
- 结束：`2026-04-19T07:34:58.900892+00:00`
- 耗时：`7.92s`
- 现象：
  - returncode=0
  - stdout_tail=-B-n9mFuu.js               285.89 kB │ gzip:  87.63 kB
dist/assets/PreviewDock-TEz6QpAH.js                   358.50 kB │ gzip:  92.06 kB
dist/assets/cytoscape.esm-NCkDCSqV.js                 434.14 kB │ gzip: 137.50 kB
dist/assets/chunk-K5T4RW27-YPYunaIi.js                474.02 kB │ gzip: 102.18 kB
dist/assets/StructuredChartBlock-DZiU-Umj.js          677.23 kB │ gzip: 225.19 kB

✓ built in 1.22s
  - stderr_tail=[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.

### WebUI E2E

- 状态：`passed`
- 摘要：WebUI 真实页面链路通过
- 开始：`2026-04-19T07:34:58.900928+00:00`
- 结束：`2026-04-19T07:35:12.452495+00:00`
- 耗时：`13.55s`
- 现象：
  - api_base_url=http://127.0.0.1:7495
  - web_base_url=http://127.0.0.1:6265
  - returncode=0
  - stdout_tail=> web@0.0.0 e2e
> playwright test


Running 5 tests using 3 workers

  -  1 [chromium] › tests/e2e/hitl-real.spec.ts:17:3 › real HITL webui › can complete a real user_input interrupt from webui
  -  4 [chromium] › tests/e2e/hitl-real.spec.ts:47:3 › real HITL webui › can complete a real tool approval interrupt from webui
  ✓  2 [chromium] › tests/e2e/chat.spec.ts:4:1 › can create a session and stream a compact step group (2.4s)
  ✓  3 [chromium] › tests/e2e/workflow.spec.ts:4:1 › can run a workflow and render its output (3.9s)
  ✓  5 [chromium] › tests/e2e/workflow.spec.ts:15:1 › can submit an agent orchestration goal from the bottom composer (1.4s)

  2 skipped
  3 passed (6.3s)
  - stderr_tail=he 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:362791) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:362784) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:362785) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:362791) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
- 产物：
  - `/opt/Agent/runtime/smoke/logs/smoke_webui_api_server.stdout.log`
  - `/opt/Agent/runtime/smoke/logs/smoke_webui_api_server.stderr.log`
  - `/opt/Agent/runtime/smoke/logs/smoke_webui_vite_server.stdout.log`
  - `/opt/Agent/runtime/smoke/logs/smoke_webui_vite_server.stderr.log`
  - `/opt/Agent/web/test-results`

### HITL Demo 状态机

- 状态：`passed`
- 摘要：HITL demo 成功完成 interrupt -> resume -> idle 流程
- 开始：`2026-04-19T07:35:12.781188+00:00`
- 结束：`2026-04-19T07:35:17.822759+00:00`
- 耗时：`5.04s`
- 现象：
  - base_url=http://127.0.0.1:44183
  - session_id=2c244c32-a8d3-4f5b-967b-245978fb1a45
  - interrupt_type=user_input
  - assistant_content="收到用户回复：{'answers': {'是否继续当前操作？': '继续'}}"
- 产物：
  - `/opt/Agent/runtime/smoke/logs/smoke_hitl_demo_server.stdout.log`
  - `/opt/Agent/runtime/smoke/logs/smoke_hitl_demo_server.stderr.log`

### 真实 HITL WebUI 联调

- 状态：`passed`
- 摘要：真实 HITL WebUI user_input / approval 页面闭环通过
- 开始：`2026-04-19T07:35:18.043320+00:00`
- 结束：`2026-04-19T07:35:40.064095+00:00`
- 耗时：`22.02s`
- 现象：
  - api_base_url=http://127.0.0.1:33331
  - hitl_base_url=http://127.0.0.1:13447
  - web_base_url=http://127.0.0.1:36641
  - resolved_model=gpt-5.4-mini
  - gpt-5.4-mini=ok:'OK'
  - returncode=0
  - stdout_tail=Running 2 tests using 1 worker

  ✓  1 [chromium] › tests/e2e/hitl-real.spec.ts:17:3 › real HITL webui › can complete a real user_input interrupt from webui (6.8s)
  ✓  2 [chromium] › tests/e2e/hitl-real.spec.ts:47:3 › real HITL webui › can complete a real tool approval interrupt from webui (6.6s)

  2 passed (14.3s)
  - stderr_tail=(node:363468) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:363468) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
- 产物：
  - `/opt/Agent/runtime/smoke/logs/smoke_real_hitl_webui_server.stdout.log`
  - `/opt/Agent/runtime/smoke/logs/smoke_real_hitl_webui_server.stderr.log`
  - `/opt/Agent/runtime/smoke/logs/smoke_real_hitl_webui_api_server.stdout.log`
  - `/opt/Agent/runtime/smoke/logs/smoke_real_hitl_webui_api_server.stderr.log`
  - `/opt/Agent/runtime/smoke/logs/smoke_real_hitl_webui_vite_server.stdout.log`
  - `/opt/Agent/runtime/smoke/logs/smoke_real_hitl_webui_vite_server.stderr.log`
  - `/opt/Agent/web/test-results`

### TUI 无头启动

- 状态：`passed`
- 摘要：TUI 成功恢复历史会话，并正常渲染系统事件条
- 开始：`2026-04-19T07:35:41.622683+00:00`
- 结束：`2026-04-19T07:35:46.037772+00:00`
- 耗时：`4.42s`
- 现象：
  - active_session_id=f94bd494-10fe-415d-98e4-cfe70205a9fd
  - session_count=96
  - visible_session_ids=['eeb5c656-3a08-472d-8d0b-5b959cc6f196', 'f94bd494-10fe-415d-98e4-cfe70205a9fd', '227a6d2a-b894-4bb5-9107-1484f45c2b71', '4640e822-6d38-4db6-918d-c041e2913676', 'b0743c86-e553-4a01-bf81-399cd746d596', 'd0469924-e764-4997-a55a-8c1e4a959bf8', '41c334c4-9c41-46be-9a45-583be40ce50d', '91a370d4-36e8-4a4d-8eb1-de68c22da13e', '0905f8a2-c160-4b96-8030-9baa5d8a0bb7', '8dc19f3a-7cde-42ed-b8b3-e936af4b0f6c', 'ab9a333c-303e-4f2a-ade7-0b76189085a2', 'bbea556b-abb2-48ee-a1b1-2b191441e3d5', '8f534ab1-05e7-415d-955f-de725337a73c', '8fcb4f79-74d8-4966-9216-59af095ddb26', '4abff1ed-2ea4-40bf-abbf-a583a2533778', 'd11e7118-10b0-4555-88ff-37917e6f1a7b', 'b7229245-42ef-4a4c-ba9d-05a79bba315c', 'f50bba46-8974-4ef9-8815-7080ef3b3c42', 'ed97f772-7a85-40bf-9616-a985b25661d0', '17936388-cd73-48c2-9935-bcfa1d3e0d76', '490e2c66-da1e-4ac2-9599-cab1349b3e81', '46ec1ace-c79f-4c99-a57a-ecb07032dea5', 'a5688916-23cd-4679-bfbc-1d38f9d70b52', '45dfa12e-8036-4f54-bd3a-6933156c6bbd', '5ff1f743-705c-4406-b5aa-c62924deda62', 'dd98db63-e388-4a05-b351-9b8b32b9a6c2', '454abbcd-dcc1-4ede-a2f2-aa32fa807bed', '626f55e1-6d89-4b61-b5a2-c0fa4c4bf145', '3d468aa8-b110-47d6-8495-7e4932a7215e', '6ebd30c2-1ec8-4dc1-aec8-3dc624c8a0f3', '777dfdac-74ac-4e47-b6da-29320bbf4238', 'a61e4fc2-bc1d-4f27-a3c7-48379706900f', '8ed59aba-1865-42da-ae21-989aeeeb67b7', '2b0317c1-ff1d-4005-a009-dad67a0ce5be', 'f2d3098d-2edf-42a9-967e-c18fd0553626', 'd0df23c6-7eb8-47c9-b031-cc71750a3c49', '6d571deb-9f77-47bf-9a99-69b6d8e265b2', '9a7caa20-24e2-448d-95d4-7be8cf84f869', '6b66077e-43ed-4d53-ac00-016d7b24636e', 'bd5727e7-432a-4517-acac-887a67cd606c', 'e78ba706-49ee-41ae-ae38-277a403f2035', 'b173f71b-9ad8-4492-bc07-ee18129c2be6', 'ad3a33e2-8263-47cc-9f0a-a035931f8cda', 'e7e93404-5934-4649-83ea-f7c44f37c6fa', '4e77545a-ae51-4dfc-a969-bb154d63a6d3', '0b8a6e93-e3bc-47cf-8713-0e1e5b6de474', '74fffc65-b2a5-4a6c-a252-2dd165254d5b', '22daf370-d9ac-4e46-9d66-7c796ebbbaf8', '7d5e7ebb-e04f-4780-9d85-5ac33d1df414', 'e923b2fb-5a24-4711-818b-5edc8cd216d1', 'ee05f249-7c34-4ddc-8da8-7be11d025076', '9f329ee1-f5ed-4718-98ed-2bd761736118', '823a657b-fa6c-4768-89b4-b9711a4f3c97', 'b0b3f56c-5018-4ad2-aa2a-46499d19c006', '5d0e3755-4000-43ac-8e3a-df39a975b0e7', '110a488c-dcfd-4a33-9bb0-638026b53d0d', 'b7ac5e02-0715-4dc1-ad8e-bb7d3d8e4f94', 'cf54cca4-8564-4d29-9b21-ec31e461d0b0', 'fc49c742-a4bc-453f-8e9c-f5858f67c171', '0dc7ec79-f994-477a-bdb2-b1a162b6aaa1', 'memory-basic-f2b76c36', '862dd6dc-5a0a-4f00-92c1-b4602960f74f', '76c46591-df77-45a3-8f6c-0882204a523f', '5e4692f6-be73-4358-b17a-b76e76dc5931', '4524caa7-0456-4686-9d1e-4ccb3b8b8839', '752f034e-93f4-425e-8d58-ab03f6d99110', '53625412-ae1a-48a9-8f7e-a475d171a79d', 'f688e803-ba83-44a6-9034-759fdfe8eee9', '7ca29683-83df-4fd4-b808-2209c3071408', 'ec7ef1ad-3fa8-48f6-8e07-410eb23bea54', 'ecf2ab0e-825e-4b59-aea4-5fa658d3cda9', '5c7d0060-7144-4e0a-8031-32a54f270c9c', '8607a4a7-bc51-46d1-80a1-155ae1f4b202', 'ab1f08d2-b21b-47f9-9b33-2022d0c3f195', '71933c0b-8eaa-414d-b54f-928477d0de5c', 'memory-basic-bc1fb410', '5f7f5e19-a64b-46ba-814b-90f727bb3ac1', '3fb4866e-43d8-4807-9352-47f011bacba5', '43c5d409-1ca5-4904-b455-2adfb2236410', '160e3964-8ea9-4113-a347-66de58163254', 'e1424b03-c873-42ca-ae66-54b61824a702', '88d591d7-7681-4cb2-a298-5b638d707466', '1d395342-9c60-42f0-b368-5925d7c8d237', '600ebb65-b041-46a9-be41-1f557b68994d', 'memory-basic-6032762a', 'cbd09fae-5373-41c9-8552-7c2b43fc17ae', '259ef7b3-9b07-4955-991d-0f4d8b4d27cd', '8fafee53-acdb-4e7d-b757-344c662dfd95', '00669b48-7ef2-445c-9770-9ac5651cfe94', 'memory-basic-82c3ed47', 'memory-basic-a4e2f214', 'dd82ca81-8275-4122-9ce1-b154183d282c', '0c4c1217-a5cf-42c8-9db9-90302f5c5a55', 'd4797e6a-966b-410d-a4ec-281040dcc93b', '5d889f30-9d27-4080-bb57-246093d81acc', 'b093d35c-a580-46e8-be82-db8e36576bba']
  - restored_session_id=f94bd494-10fe-415d-98e4-cfe70205a9fd
  - restored_title='TUI 恢复回归 b5fd9686'
  - restored_found=True
  - composer_id=composer
  - sessions_list_id=sessions-list
  - session_search_id=session-search
  - runtime_panel_id=runtime-panel
  - runtime_alerts_id=config-runtime-alerts
  - timeout_input_value='600'
  - step_event_text_present=True
- 产物：
  - `/opt/Agent/runtime/smoke/tui-step-event.svg`

### Firecrawl 网页检索

- 状态：`passed`
- 摘要：agent 成功通过 web_search 完成联网检索
- 开始：`2026-04-19T07:35:46.064459+00:00`
- 结束：`2026-04-19T07:35:55.133947+00:00`
- 耗时：`9.07s`
- 现象：
  - session_id=8cc031f2-19bd-4993-971c-0924210ff5ec
  - observed_tool_calls=['web_search']
  - assistant='首屏结果主题是 OpenAI 官方网站，核心是在介绍其“让通用人工智能造福全人类”的使命。'

### MCP 集成探测

- 状态：`skipped`
- 摘要：当前环境未提供可用的 MCP 测试目标，自动跳过
- 开始：`2026-04-19T07:35:55.133987+00:00`
- 结束：`2026-04-19T07:35:55.134031+00:00`
- 耗时：`0.00s`
- 现象：
  - 可通过 SMOKE_MCP_REMOTE_URL 或 SMOKE_MCP_LOCAL_COMMAND 注入测试目标。

## 原始 JSON

```json
[
  {
    "name": "静态与入口校验",
    "status": "passed",
    "summary": "语法编译和入口模块导入通过",
    "started_at": "2026-04-19T07:34:21.047555+00:00",
    "finished_at": "2026-04-19T07:34:25.323290+00:00",
    "duration_seconds": 4.275735,
    "details": [
      "py_compile.returncode=0",
      "imports.returncode=0",
      "imports.stdout='imports-ok'",
      "py_compile.stderr=''",
      "imports.stderr=''"
    ],
    "artifacts": [],
    "error": null
  },
  {
    "name": "本地普通会话",
    "status": "passed",
    "summary": "本地普通会话完成并导出 session trace",
    "started_at": "2026-04-19T07:34:27.963938+00:00",
    "finished_at": "2026-04-19T07:34:31.159359+00:00",
    "duration_seconds": 3.195421,
    "details": [
      "session_id=d0469924-e764-4997-a55a-8c1e4a959bf8",
      "assistant='LOCAL_SMOKE_OK_8b382de0'",
      "trace_log_dir=/opt/Agent/runtime/traces/sessions/d0469924-e764-4997-a55a-8c1e4a959bf8",
      "trace_files=['jaeger_traces.json', 'trace_viewer.html', 'tracer_state.json']"
    ],
    "artifacts": [
      "/opt/Agent/runtime/traces/sessions/d0469924-e764-4997-a55a-8c1e4a959bf8",
      "/opt/Agent/runtime/traces/sessions/d0469924-e764-4997-a55a-8c1e4a959bf8/jaeger_traces.json",
      "/opt/Agent/runtime/traces/sessions/d0469924-e764-4997-a55a-8c1e4a959bf8/trace_viewer.html",
      "/opt/Agent/runtime/traces/sessions/d0469924-e764-4997-a55a-8c1e4a959bf8/tracer_state.json"
    ],
    "error": null
  },
  {
    "name": "本地多代理会话",
    "status": "passed",
    "summary": "多代理委派成功，专家参与了本地文件读取",
    "started_at": "2026-04-19T07:34:31.159392+00:00",
    "finished_at": "2026-04-19T07:34:41.425074+00:00",
    "duration_seconds": 10.265682,
    "details": [
      "session_id=4640e822-6d38-4db6-918d-c041e2913676",
      "assistant='CODE=8B63EE37D3'",
      "specialist_used=True",
      "agent_metrics_count=2",
      "trace_log_dir=/opt/Agent/runtime/traces/sessions/4640e822-6d38-4db6-918d-c041e2913676",
      "trace_files=['jaeger_traces.json', 'trace_viewer.html', 'tracer_state.json']"
    ],
    "artifacts": [
      "/opt/Agent/runtime/smoke/multi_agent_input.txt",
      "/opt/Agent/runtime/traces/sessions/4640e822-6d38-4db6-918d-c041e2913676",
      "/opt/Agent/runtime/traces/sessions/4640e822-6d38-4db6-918d-c041e2913676/jaeger_traces.json",
      "/opt/Agent/runtime/traces/sessions/4640e822-6d38-4db6-918d-c041e2913676/trace_viewer.html",
      "/opt/Agent/runtime/traces/sessions/4640e822-6d38-4db6-918d-c041e2913676/tracer_state.json"
    ],
    "error": null
  },
  {
    "name": "Workflow Text Insights",
    "status": "passed",
    "summary": "workflow 运行完成并成功导出 workflow run 级 trace",
    "started_at": "2026-04-19T07:34:41.430122+00:00",
    "finished_at": "2026-04-19T07:34:41.495030+00:00",
    "duration_seconds": 0.064908,
    "details": [
      "run_id=605a6892-663c-496f-9cdd-c2f435694aac",
      "workflow_status=completed",
      "trace_scope=workflow",
      "trace_log_dir=/opt/Agent/runtime/traces/workflows/605a6892-663c-496f-9cdd-c2f435694aac",
      "trace_files=['jaeger_traces.json', 'trace_viewer.html', 'tracer_state.json']",
      "output_keys=['headings', 'keywords', 'preview', 'stats']"
    ],
    "artifacts": [
      "/opt/Agent/runtime/traces/workflows/605a6892-663c-496f-9cdd-c2f435694aac",
      "/opt/Agent/runtime/traces/workflows/605a6892-663c-496f-9cdd-c2f435694aac/jaeger_traces.json",
      "/opt/Agent/runtime/traces/workflows/605a6892-663c-496f-9cdd-c2f435694aac/trace_viewer.html",
      "/opt/Agent/runtime/traces/workflows/605a6892-663c-496f-9cdd-c2f435694aac/tracer_state.json"
    ],
    "error": null
  },
  {
    "name": "HTTP API 健康检查",
    "status": "passed",
    "summary": "HTTP 服务启动成功，health 接口可访问",
    "started_at": "2026-04-19T07:34:41.495495+00:00",
    "finished_at": "2026-04-19T07:34:47.365279+00:00",
    "duration_seconds": 5.869784,
    "details": [
      "base_url=http://127.0.0.1:38669",
      "health={'status': 'ok', 'sessions': 93}"
    ],
    "artifacts": [
      "/opt/Agent/runtime/smoke/logs/smoke_http_api_server.stdout.log",
      "/opt/Agent/runtime/smoke/logs/smoke_http_api_server.stderr.log"
    ],
    "error": null
  },
  {
    "name": "HTTP API 会话与流式事件",
    "status": "passed",
    "summary": "会话创建、SSE 流和 session tracing 接口正常",
    "started_at": "2026-04-19T07:34:47.365304+00:00",
    "finished_at": "2026-04-19T07:34:50.703220+00:00",
    "duration_seconds": 3.337916,
    "details": [
      "session_id=227a6d2a-b894-4bb5-9107-1484f45c2b71",
      "event_names=['session.started', 'assistant.final', 'done']",
      "assistant_content='HTTP_STREAM_OK_227a6d2a'",
      "trace_log_dir=/opt/Agent/runtime/traces/sessions/227a6d2a-b894-4bb5-9107-1484f45c2b71",
      "trace_files=['jaeger_traces.json', 'trace_viewer.html', 'tracer_state.json']"
    ],
    "artifacts": [
      "/opt/Agent/runtime/traces/sessions/227a6d2a-b894-4bb5-9107-1484f45c2b71",
      "/opt/Agent/runtime/traces/sessions/227a6d2a-b894-4bb5-9107-1484f45c2b71/jaeger_traces.json",
      "/opt/Agent/runtime/traces/sessions/227a6d2a-b894-4bb5-9107-1484f45c2b71/trace_viewer.html",
      "/opt/Agent/runtime/traces/sessions/227a6d2a-b894-4bb5-9107-1484f45c2b71/tracer_state.json"
    ],
    "error": null
  },
  {
    "name": "HTTP API Workflow 与 Tracing",
    "status": "passed",
    "summary": "workflow API 与 workflow run tracing 接口正常",
    "started_at": "2026-04-19T07:34:50.703242+00:00",
    "finished_at": "2026-04-19T07:34:50.769692+00:00",
    "duration_seconds": 0.06645,
    "details": [
      "run_id=8fcedb69-b508-4b7c-92c5-6955de501c3f",
      "workflow_status=completed",
      "trace_log_dir=/opt/Agent/runtime/traces/workflows/8fcedb69-b508-4b7c-92c5-6955de501c3f",
      "trace_files=['jaeger_traces.json', 'trace_viewer.html', 'tracer_state.json']"
    ],
    "artifacts": [
      "/opt/Agent/runtime/traces/workflows/8fcedb69-b508-4b7c-92c5-6955de501c3f",
      "/opt/Agent/runtime/traces/workflows/8fcedb69-b508-4b7c-92c5-6955de501c3f/jaeger_traces.json",
      "/opt/Agent/runtime/traces/workflows/8fcedb69-b508-4b7c-92c5-6955de501c3f/trace_viewer.html",
      "/opt/Agent/runtime/traces/workflows/8fcedb69-b508-4b7c-92c5-6955de501c3f/tracer_state.json"
    ],
    "error": null
  },
  {
    "name": "WebUI 构建",
    "status": "passed",
    "summary": "WebUI 构建通过",
    "started_at": "2026-04-19T07:34:50.984627+00:00",
    "finished_at": "2026-04-19T07:34:58.900892+00:00",
    "duration_seconds": 7.916265,
    "details": [
      "returncode=0",
      "stdout_tail=-B-n9mFuu.js               285.89 kB │ gzip:  87.63 kB\ndist/assets/PreviewDock-TEz6QpAH.js                   358.50 kB │ gzip:  92.06 kB\ndist/assets/cytoscape.esm-NCkDCSqV.js                 434.14 kB │ gzip: 137.50 kB\ndist/assets/chunk-K5T4RW27-YPYunaIi.js                474.02 kB │ gzip: 102.18 kB\ndist/assets/StructuredChartBlock-DZiU-Umj.js          677.23 kB │ gzip: 225.19 kB\n\n✓ built in 1.22s",
      "stderr_tail=[plugin builtin:vite-reporter] \n(!) Some chunks are larger than 500 kB after minification. Consider:\n- Using dynamic import() to code-split the application\n- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting\n- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit."
    ],
    "artifacts": [],
    "error": null
  },
  {
    "name": "WebUI E2E",
    "status": "passed",
    "summary": "WebUI 真实页面链路通过",
    "started_at": "2026-04-19T07:34:58.900928+00:00",
    "finished_at": "2026-04-19T07:35:12.452495+00:00",
    "duration_seconds": 13.551567,
    "details": [
      "api_base_url=http://127.0.0.1:7495",
      "web_base_url=http://127.0.0.1:6265",
      "returncode=0",
      "stdout_tail=> web@0.0.0 e2e\n> playwright test\n\n\nRunning 5 tests using 3 workers\n\n  -  1 [chromium] › tests/e2e/hitl-real.spec.ts:17:3 › real HITL webui › can complete a real user_input interrupt from webui\n  -  4 [chromium] › tests/e2e/hitl-real.spec.ts:47:3 › real HITL webui › can complete a real tool approval interrupt from webui\n  ✓  2 [chromium] › tests/e2e/chat.spec.ts:4:1 › can create a session and stream a compact step group (2.4s)\n  ✓  3 [chromium] › tests/e2e/workflow.spec.ts:4:1 › can run a workflow and render its output (3.9s)\n  ✓  5 [chromium] › tests/e2e/workflow.spec.ts:15:1 › can submit an agent orchestration goal from the bottom composer (1.4s)\n\n  2 skipped\n  3 passed (6.3s)",
      "stderr_tail=he 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.\n(Use `node --trace-warnings ...` to show where the warning was created)\n(node:362791) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.\n(Use `node --trace-warnings ...` to show where the warning was created)\n(node:362784) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.\n(Use `node --trace-warnings ...` to show where the warning was created)\n(node:362785) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.\n(Use `node --trace-warnings ...` to show where the warning was created)\n(node:362791) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.\n(Use `node --trace-warnings ...` to show where the warning was created)"
    ],
    "artifacts": [
      "/opt/Agent/runtime/smoke/logs/smoke_webui_api_server.stdout.log",
      "/opt/Agent/runtime/smoke/logs/smoke_webui_api_server.stderr.log",
      "/opt/Agent/runtime/smoke/logs/smoke_webui_vite_server.stdout.log",
      "/opt/Agent/runtime/smoke/logs/smoke_webui_vite_server.stderr.log",
      "/opt/Agent/web/test-results"
    ],
    "error": null
  },
  {
    "name": "HITL Demo 状态机",
    "status": "passed",
    "summary": "HITL demo 成功完成 interrupt -> resume -> idle 流程",
    "started_at": "2026-04-19T07:35:12.781188+00:00",
    "finished_at": "2026-04-19T07:35:17.822759+00:00",
    "duration_seconds": 5.041571,
    "details": [
      "base_url=http://127.0.0.1:44183",
      "session_id=2c244c32-a8d3-4f5b-967b-245978fb1a45",
      "interrupt_type=user_input",
      "assistant_content=\"收到用户回复：{'answers': {'是否继续当前操作？': '继续'}}\""
    ],
    "artifacts": [
      "/opt/Agent/runtime/smoke/logs/smoke_hitl_demo_server.stdout.log",
      "/opt/Agent/runtime/smoke/logs/smoke_hitl_demo_server.stderr.log"
    ],
    "error": null
  },
  {
    "name": "真实 HITL WebUI 联调",
    "status": "passed",
    "summary": "真实 HITL WebUI user_input / approval 页面闭环通过",
    "started_at": "2026-04-19T07:35:18.043320+00:00",
    "finished_at": "2026-04-19T07:35:40.064095+00:00",
    "duration_seconds": 22.020775,
    "details": [
      "api_base_url=http://127.0.0.1:33331",
      "hitl_base_url=http://127.0.0.1:13447",
      "web_base_url=http://127.0.0.1:36641",
      "resolved_model=gpt-5.4-mini",
      "gpt-5.4-mini=ok:'OK'",
      "returncode=0",
      "stdout_tail=Running 2 tests using 1 worker\n\n  ✓  1 [chromium] › tests/e2e/hitl-real.spec.ts:17:3 › real HITL webui › can complete a real user_input interrupt from webui (6.8s)\n  ✓  2 [chromium] › tests/e2e/hitl-real.spec.ts:47:3 › real HITL webui › can complete a real tool approval interrupt from webui (6.6s)\n\n  2 passed (14.3s)",
      "stderr_tail=(node:363468) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.\n(Use `node --trace-warnings ...` to show where the warning was created)\n(node:363468) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.\n(Use `node --trace-warnings ...` to show where the warning was created)"
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
  },
  {
    "name": "TUI 无头启动",
    "status": "passed",
    "summary": "TUI 成功恢复历史会话，并正常渲染系统事件条",
    "started_at": "2026-04-19T07:35:41.622683+00:00",
    "finished_at": "2026-04-19T07:35:46.037772+00:00",
    "duration_seconds": 4.415089,
    "details": [
      "active_session_id=f94bd494-10fe-415d-98e4-cfe70205a9fd",
      "session_count=96",
      "visible_session_ids=['eeb5c656-3a08-472d-8d0b-5b959cc6f196', 'f94bd494-10fe-415d-98e4-cfe70205a9fd', '227a6d2a-b894-4bb5-9107-1484f45c2b71', '4640e822-6d38-4db6-918d-c041e2913676', 'b0743c86-e553-4a01-bf81-399cd746d596', 'd0469924-e764-4997-a55a-8c1e4a959bf8', '41c334c4-9c41-46be-9a45-583be40ce50d', '91a370d4-36e8-4a4d-8eb1-de68c22da13e', '0905f8a2-c160-4b96-8030-9baa5d8a0bb7', '8dc19f3a-7cde-42ed-b8b3-e936af4b0f6c', 'ab9a333c-303e-4f2a-ade7-0b76189085a2', 'bbea556b-abb2-48ee-a1b1-2b191441e3d5', '8f534ab1-05e7-415d-955f-de725337a73c', '8fcb4f79-74d8-4966-9216-59af095ddb26', '4abff1ed-2ea4-40bf-abbf-a583a2533778', 'd11e7118-10b0-4555-88ff-37917e6f1a7b', 'b7229245-42ef-4a4c-ba9d-05a79bba315c', 'f50bba46-8974-4ef9-8815-7080ef3b3c42', 'ed97f772-7a85-40bf-9616-a985b25661d0', '17936388-cd73-48c2-9935-bcfa1d3e0d76', '490e2c66-da1e-4ac2-9599-cab1349b3e81', '46ec1ace-c79f-4c99-a57a-ecb07032dea5', 'a5688916-23cd-4679-bfbc-1d38f9d70b52', '45dfa12e-8036-4f54-bd3a-6933156c6bbd', '5ff1f743-705c-4406-b5aa-c62924deda62', 'dd98db63-e388-4a05-b351-9b8b32b9a6c2', '454abbcd-dcc1-4ede-a2f2-aa32fa807bed', '626f55e1-6d89-4b61-b5a2-c0fa4c4bf145', '3d468aa8-b110-47d6-8495-7e4932a7215e', '6ebd30c2-1ec8-4dc1-aec8-3dc624c8a0f3', '777dfdac-74ac-4e47-b6da-29320bbf4238', 'a61e4fc2-bc1d-4f27-a3c7-48379706900f', '8ed59aba-1865-42da-ae21-989aeeeb67b7', '2b0317c1-ff1d-4005-a009-dad67a0ce5be', 'f2d3098d-2edf-42a9-967e-c18fd0553626', 'd0df23c6-7eb8-47c9-b031-cc71750a3c49', '6d571deb-9f77-47bf-9a99-69b6d8e265b2', '9a7caa20-24e2-448d-95d4-7be8cf84f869', '6b66077e-43ed-4d53-ac00-016d7b24636e', 'bd5727e7-432a-4517-acac-887a67cd606c', 'e78ba706-49ee-41ae-ae38-277a403f2035', 'b173f71b-9ad8-4492-bc07-ee18129c2be6', 'ad3a33e2-8263-47cc-9f0a-a035931f8cda', 'e7e93404-5934-4649-83ea-f7c44f37c6fa', '4e77545a-ae51-4dfc-a969-bb154d63a6d3', '0b8a6e93-e3bc-47cf-8713-0e1e5b6de474', '74fffc65-b2a5-4a6c-a252-2dd165254d5b', '22daf370-d9ac-4e46-9d66-7c796ebbbaf8', '7d5e7ebb-e04f-4780-9d85-5ac33d1df414', 'e923b2fb-5a24-4711-818b-5edc8cd216d1', 'ee05f249-7c34-4ddc-8da8-7be11d025076', '9f329ee1-f5ed-4718-98ed-2bd761736118', '823a657b-fa6c-4768-89b4-b9711a4f3c97', 'b0b3f56c-5018-4ad2-aa2a-46499d19c006', '5d0e3755-4000-43ac-8e3a-df39a975b0e7', '110a488c-dcfd-4a33-9bb0-638026b53d0d', 'b7ac5e02-0715-4dc1-ad8e-bb7d3d8e4f94', 'cf54cca4-8564-4d29-9b21-ec31e461d0b0', 'fc49c742-a4bc-453f-8e9c-f5858f67c171', '0dc7ec79-f994-477a-bdb2-b1a162b6aaa1', 'memory-basic-f2b76c36', '862dd6dc-5a0a-4f00-92c1-b4602960f74f', '76c46591-df77-45a3-8f6c-0882204a523f', '5e4692f6-be73-4358-b17a-b76e76dc5931', '4524caa7-0456-4686-9d1e-4ccb3b8b8839', '752f034e-93f4-425e-8d58-ab03f6d99110', '53625412-ae1a-48a9-8f7e-a475d171a79d', 'f688e803-ba83-44a6-9034-759fdfe8eee9', '7ca29683-83df-4fd4-b808-2209c3071408', 'ec7ef1ad-3fa8-48f6-8e07-410eb23bea54', 'ecf2ab0e-825e-4b59-aea4-5fa658d3cda9', '5c7d0060-7144-4e0a-8031-32a54f270c9c', '8607a4a7-bc51-46d1-80a1-155ae1f4b202', 'ab1f08d2-b21b-47f9-9b33-2022d0c3f195', '71933c0b-8eaa-414d-b54f-928477d0de5c', 'memory-basic-bc1fb410', '5f7f5e19-a64b-46ba-814b-90f727bb3ac1', '3fb4866e-43d8-4807-9352-47f011bacba5', '43c5d409-1ca5-4904-b455-2adfb2236410', '160e3964-8ea9-4113-a347-66de58163254', 'e1424b03-c873-42ca-ae66-54b61824a702', '88d591d7-7681-4cb2-a298-5b638d707466', '1d395342-9c60-42f0-b368-5925d7c8d237', '600ebb65-b041-46a9-be41-1f557b68994d', 'memory-basic-6032762a', 'cbd09fae-5373-41c9-8552-7c2b43fc17ae', '259ef7b3-9b07-4955-991d-0f4d8b4d27cd', '8fafee53-acdb-4e7d-b757-344c662dfd95', '00669b48-7ef2-445c-9770-9ac5651cfe94', 'memory-basic-82c3ed47', 'memory-basic-a4e2f214', 'dd82ca81-8275-4122-9ce1-b154183d282c', '0c4c1217-a5cf-42c8-9db9-90302f5c5a55', 'd4797e6a-966b-410d-a4ec-281040dcc93b', '5d889f30-9d27-4080-bb57-246093d81acc', 'b093d35c-a580-46e8-be82-db8e36576bba']",
      "restored_session_id=f94bd494-10fe-415d-98e4-cfe70205a9fd",
      "restored_title='TUI 恢复回归 b5fd9686'",
      "restored_found=True",
      "composer_id=composer",
      "sessions_list_id=sessions-list",
      "session_search_id=session-search",
      "runtime_panel_id=runtime-panel",
      "runtime_alerts_id=config-runtime-alerts",
      "timeout_input_value='600'",
      "step_event_text_present=True"
    ],
    "artifacts": [
      "/opt/Agent/runtime/smoke/tui-step-event.svg"
    ],
    "error": null
  },
  {
    "name": "Firecrawl 网页检索",
    "status": "passed",
    "summary": "agent 成功通过 web_search 完成联网检索",
    "started_at": "2026-04-19T07:35:46.064459+00:00",
    "finished_at": "2026-04-19T07:35:55.133947+00:00",
    "duration_seconds": 9.069488,
    "details": [
      "session_id=8cc031f2-19bd-4993-971c-0924210ff5ec",
      "observed_tool_calls=['web_search']",
      "assistant='首屏结果主题是 OpenAI 官方网站，核心是在介绍其“让通用人工智能造福全人类”的使命。'"
    ],
    "artifacts": [],
    "error": null
  },
  {
    "name": "MCP 集成探测",
    "status": "skipped",
    "summary": "当前环境未提供可用的 MCP 测试目标，自动跳过",
    "started_at": "2026-04-19T07:35:55.133987+00:00",
    "finished_at": "2026-04-19T07:35:55.134031+00:00",
    "duration_seconds": 4.4e-05,
    "details": [
      "可通过 SMOKE_MCP_REMOTE_URL 或 SMOKE_MCP_LOCAL_COMMAND 注入测试目标。"
    ],
    "artifacts": [],
    "error": null
  }
]
```
