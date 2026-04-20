# 真实 Provider + HITL 联调矩阵

## 范围

本轮目标分两部分：

- WebUI 接入新后端能力：
  - `runtime/tools`
  - `runtime/workflow-catalog`
  - workflow `cancel / terminate`
  - session `model_client`
- 用真实 provider 跑一轮本地统一 API + HITL 统一 API 联调矩阵

执行日期：`2026-04-19`

## 环境结论

根目录 `.env` 中当前可用于真实联调的关键变量：

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `FIRECRAWL_KEY`

因此本轮真实 provider 只执行 `openai` 路径；`anthropic / gemini / openrouter` 因未配置对应密钥，未纳入真实矩阵。

真实模型探测结果：

- 选中模型：`gpt-5.4-mini`

## WebUI 接入结果

已完成接线：

- 会话高级配置支持 `model_client.mode / base_url / api_key_env_var`
- 右侧运行时面板支持展示工具目录与 workflow 宿主目录
- 新会话默认工具启用逻辑改为优先基于 runtime catalog 下发
- 工作流页面支持 `cancel / terminate`

主要代码位置：

- [contracts.ts](/opt/Agent/web/src/shared/api/contracts.ts)
- [constants.ts](/opt/Agent/web/src/features/sessions/constants.ts)
- [SessionConfigPanel.tsx](/opt/Agent/web/src/features/sessions/components/SessionConfigPanel.tsx)
- [RuntimeRequirementsPanel.tsx](/opt/Agent/web/src/features/runtime/components/RuntimeRequirementsPanel.tsx)
- [WorkflowPage.tsx](/opt/Agent/web/src/features/workflows/pages/WorkflowPage.tsx)
- [WorkflowWorkspace.tsx](/opt/Agent/web/src/features/workflows/components/WorkflowWorkspace.tsx)

前端验证结果：

- `npm run build`：通过
- `npm test`：`61` 个测试全部通过

## 真实联调矩阵

执行命令：

```bash
uv run python -m scripts.smoke.http_api
uv run python -m scripts.smoke.hitl_real
```

补充验证：

- `local_runtime_catalog`：通过，工具数 `13`，workflow 数 `2`
- `hitl_runtime_catalog`：通过，工具数 `13`，workflow 数 `2`
- `local_model_client_override`：通过，返回 `LOCAL_MODEL_CLIENT_OK_64f6c12b`
- `hitl_model_client_override`：通过，返回 `HITL_MODEL_CLIENT_OK_27fa7c16`

脚本输出要点：

- 本地统一 API：
  - 健康检查通过
  - 会话 SSE 链路通过
  - workflow + tracing 链路通过
- 真实 HITL：
  - `user_input interrupt -> resume -> idle` 通过
  - `tool_approval interrupt -> resume -> idle` 通过

## 结果文档与产物

- [真实-HITL-端到端联调结果.md](/opt/Agent/docs/真实-HITL-端到端联调结果.md)
- [system-smoke-test-results.md](/opt/Agent/docs/system-smoke-test-results.md)
- `runtime/smoke/real-hitl-e2e-results.json`
- `runtime/smoke/logs/`

## 现象与结论

- 本轮新增的 WebUI 接线已经和后端新能力对齐。
- `model_client` 在 `local / hitl` 两条真实链路下都已验证通过。
- runtime catalog 两端返回一致，WebUI 可以安全依赖该目录而不是继续硬编码。
- 当前唯一剩余明显问题不是功能正确性，而是前端构建体积：`StructuredChartBlock`、`PreviewDock`、`MarkdownMessage` 相关 chunk 仍然偏大，后续应继续拆分。
