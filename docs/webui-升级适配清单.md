# WebUI 升级适配清单

本文基于 [前端接入说明](./前端接入说明.md) 与当前 `web/` 实现整理，目标是把 WebUI 补齐到与后端最新 Motus 能力一致。

## 1. 当前现状

### 已接入

- [x] 已有 `GET /api/meta` 调用入口
- [x] 已有会话创建、更新、消息收发、删除、流式渲染
- [x] 已有 workflow 规划、运行、运行详情页面
- [x] 已有 tracing、runtime requirements、preview 基础面板
- [x] 会话页已具备“常用控制在输入区、高级控制在右侧栏”的总体形态

### 主要缺口

- [ ] `contracts.ts` 仍是旧版 schema，未覆盖 `provider / cache_policy / sandbox / guardrails / response_format / memory`
- [ ] `appMetaSchema` 未接 `backend_mode` 与 `supports_*` 能力位
- [ ] session 草稿与右侧配置面板仍缺少高级治理字段
- [ ] workflow 前端未接 `runtime` 与 `attempt_count`
- [ ] UI 还没有基于 `/api/meta` 做能力开关和禁用态

## 2. P0：先补契约与能力探测

### 2.1 统一前端 API 契约

- [ ] 修改 `web/src/shared/api/contracts.ts`
- [ ] `appMetaSchema` 增加：
  - `backend_mode`
  - `supports_interrupts`
  - `supports_dynamic_session_config`
  - `supports_preview`
  - `supports_structured_response_format`
- [ ] `mcpServerConfigSchema` 增加：
  - `prefix`
  - `allowlist`
  - `blocklist`
  - `method_aliases`
  - `image`
  - `port`
  - `sandbox_path`
  - `sandbox`
- [ ] `sessionCreateRequestSchema / sessionUpdateRequestSchema / sessionDetailSchema` 增加：
  - `provider`
  - `cache_policy`
  - `sandbox`
  - `human_in_the_loop`
  - `approval_tool_names`
  - `input_guardrails`
  - `output_guardrails`
  - `tool_guardrails`
  - `response_format`
  - `memory`
- [ ] `workflowRunSummarySchema / workflowRunDetailSchema` 增加：
  - `runtime`
  - `attempt_count`
- [ ] `startWorkflowRun()` 请求体补 `runtime`

### 2.2 能力探测驱动 UI

- [ ] 修改 `web/src/features/meta/components/MetaPanel.tsx`
- [ ] 在页面中明确展示：
  - `backend_mode`
  - `supports_interrupts`
  - `supports_dynamic_session_config`
  - `supports_preview`
  - `supports_structured_response_format`
- [ ] 修改 `web/src/features/chat/pages/ChatPage.tsx`
- [ ] 修改 `web/src/features/workflows/pages/WorkflowPage.tsx`
- [ ] 按能力位做 UI 开关：
  - `supports_interrupts=false` 时隐藏 `human_in_the_loop` 与审批配置
  - `supports_dynamic_session_config=false` 时右侧配置改只读
  - `supports_preview=false` 时隐藏代码预览与终端预览
  - `supports_structured_response_format=false` 时隐藏结构化输出编辑器

### P0 验收

- [ ] 打开 WebUI 后 `/api/meta` 新字段全部可见
- [ ] 切换不同 backend 时，相关高级配置能自动隐藏或只读
- [ ] session / workflow contract 不再因后端新字段报解析错误

## 3. P1：补齐 Session 新字段编辑

### 3.1 草稿与映射层

- [ ] 修改 `web/src/features/sessions/constants.ts`
- [ ] 扩展 `SessionDraft`，加入：
  - `provider`
  - `cachePolicy`
  - `sandboxText` 或结构化 `sandbox`
  - `humanInTheLoop`
  - `approvalToolNamesText`
  - `inputGuardrailsText`
  - `outputGuardrailsText`
  - `toolGuardrailsText`
  - `responseFormatText`
  - `memoryText` 或结构化 `memory`
- [ ] 更新 `sessionDetailToDraft()`
- [ ] 更新 `buildSessionCreatePayload()`
- [ ] 更新 `buildSessionUpdatePayload()`

### 3.2 右侧高级配置面板

- [ ] 修改 `web/src/features/sessions/components/SessionConfigPanel.tsx`
- [ ] 按《前端接入说明》改为模块分组：
  1. 模型
  2. 工具
  3. MCP
  4. 多代理
  5. Guardrails
  6. Memory
  7. Sandbox
- [ ] 常用控制继续放在输入区下方：
  - `provider`
  - `model_name`
  - `thinking`
  - `max_steps`
  - `timeout_seconds`
- [ ] 高级区补：
  - `cache_policy`
  - `sandbox`
  - `mcp_servers`
  - `multi_agent`
  - `response_format`
  - `memory`
  - `input_guardrails / output_guardrails / tool_guardrails`

### 3.3 推荐控件形态

- [ ] `sandbox` 做单选卡：`local / docker / cloud`
- [ ] `memory` 做简单模式切换：`basic / compact`
- [ ] `response_format` 做字段表单编辑器，不直接暴露原始 JSON
- [ ] `guardrails` 做规则列表编辑器，每条规则单独编辑
- [ ] `tool_guardrails` 支持工具名、路径字段、绝对路径限制、允许根目录
- [ ] `MCP` 表单区分 `remote_http / local_stdio`

### P1 验收

- [ ] 新建会话时可以完整提交新版后端字段
- [ ] 进入已有会话后，右侧显示“当前 session 的真实生效配置”
- [ ] 保存配置后刷新页面，字段可正确回填

## 4. P2：补齐 Workflow runtime

### 4.1 契约与 API

- [ ] 修改 `web/src/features/workflows/api.ts`
- [ ] `startWorkflowRun()` 支持提交：
  - `runtime.timeout_seconds`
  - `runtime.max_retries`
  - `runtime.retry_delay_seconds`

### 4.2 页面与展示

- [ ] 修改 `web/src/features/workflows/components/WorkflowWorkspace.tsx`
- [ ] 修改 `web/src/features/workflows/pages/WorkflowPage.tsx`
- [ ] 在 workflow 输入区增加运行策略编辑：
  - `timeout_seconds`
  - `max_retries`
  - `retry_delay_seconds`
- [ ] 在运行详情展示：
  - 当前 `runtime`
  - `attempt_count`
  - 是否因超时/重试进入错误态

### P2 验收

- [ ] 手动运行 workflow 时可设置 timeout/retry
- [ ] 运行结果页能看到实际重试次数
- [ ] agent 自动编排运行与手动运行都兼容新版 schema

## 5. P3：复杂编辑器与体验优化

### 5.1 结构化输出

- [ ] 增加 `response_format` 字段编辑器
- [ ] assistant 消息仍按普通消息兼容渲染
- [ ] 若配置了结构化输出，可额外提供“原始 JSON”查看入口

### 5.2 Guardrails 与 MCP

- [ ] Guardrails 不要只给 JSON 文本框，至少提供规则项增删改
- [ ] MCP 支持：
  - 远端 URL 与 headers
  - 本地 command / args / env
  - 工具暴露策略 `prefix / allowlist / blocklist / method_aliases`
  - 可选 sandbox 配置

### 5.3 测试补齐

- [ ] 更新或新增：
  - `web/src/shared/api/contracts` 相关测试
  - `SessionConfigPanel` 测试
  - `WorkflowWorkspace` 测试
  - `/api/meta` 能力位联动测试
- [ ] 增加一条 smoke：
  - 创建带 `sandbox + memory + response_format` 的会话
  - 创建带 `runtime` 的 workflow run

## 6. 建议实施顺序

1. 先改 `contracts.ts`，避免前后端继续错位。
2. 再接 `/api/meta` 能力位，让 UI 先具备正确的显示/隐藏逻辑。
3. 然后补 session 新字段的读写与回填。
4. 再补 workflow runtime。
5. 最后做 guardrails、MCP、response_format、memory 的结构化编辑器。

## 7. 本轮结论

当前 WebUI 已经有较完整的聊天与编排壳层，但对最新后端 Motus 能力的适配还停留在“旧 contract + 部分高级区”的阶段。优先级最高的不是继续堆 UI，而是先把 `contracts.ts`、`SessionDraft`、`/api/meta` 能力开关、workflow runtime 四块补齐，这样后续无论是 WebUI 还是 Tauri 外壳，都能共用同一套稳定前端契约。
