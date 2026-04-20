# Motus 后端 P0-P2 TODO

对应路线文档见：[Motus 后端特性补齐路线图](/opt/Agent/docs/motus-backend-p0-p2-plan.md)

## 使用方式

- 本文档只负责执行项，不重复解释背景
- 勾选顺序默认按 `P0 -> P1 -> P2`
- 每完成一个小项，补对应 smoke 记录到 `docs/motus-backend-p0-p2-smoke.md`

## P0：统一语义与恢复能力

### 统一消息语义

- [x] 盘点 `local backend` 与 `hitl backend` 当前消息入参差异
- [x] 设计统一消息请求体最小兼容范围：`content / user_params / base64_image / webhook / files`
- [x] 为 `LocalSessionBackend` 增加 `run_turn_message` 或等价统一入口
- [x] 让本地会话支持非纯字符串用户消息，不再只认 `content: str`
- [x] 明确本地模式下 `webhook` 的处理策略：支持、透传、还是显式拒绝
- [x] 统一 `/api/sessions/{id}/messages`、`wait=true`、`wait=false`、`stream` 三条路径的行为

### 会话运行态修正

- [x] 复查 `ChatSessionStateMixin._reconcile_runtime_state()` 与 HITL `PersistentSession.reconcile_runtime_state()`
- [x] 统一“运行超时 / worker 退出 / 无活动卡死”的状态落盘规则
- [x] 确保列表查询、详情查询、SSE 中看到的状态一致
- [x] 确保异常结束后 usage / cost / last_error 不丢

### HITL 重启恢复语义

- [x] 梳理当前 `running / interrupted -> error` 降级逻辑的真实边界
- [x] 定义哪些 interrupt 可继续恢复，哪些必须重发
- [x] 后端返回明确的不可恢复标志，避免前端继续展示伪 resume
- [x] 为重启后的 HITL 会话补稳定错误文案与诊断信息

### P0 Smoke

- [x] 验证本地 backend 可接受带 `user_params` 的消息
- [x] 验证本地会话卡死后能自动从 `running` 转为 `error`
- [x] 验证 HITL 会话在服务重启后不会出现“前端可点恢复、后端拒绝”的假闭环
- [x] 验证 `wait=true`、202 异步派发、SSE stream 三条链路都可复跑

## P1：高级编排与复杂输出能力

### 多代理高级能力

- [x] 扩展 `SpecialistAgentConfig`，补齐 `output_extractor` 的声明式配置
- [x] 明确子代理工具参数的可配置边界
- [x] 梳理 `stateful=False` 时的 `fork` 语义，并补文档说明
- [x] 让多代理配置不再只停留在“普通专家工具”层

### 复杂结构化输出

- [x] 设计下一版 `ResponseFormatConfig`，支持嵌套对象
- [x] 设计数组、可选字段、结构组合的声明式 schema
- [x] 保持前后端共享 schema，不直接暴露任意 Python 类
- [x] 补一条真实结构化回复的端到端验证链路

### 会话级模型客户端覆盖

- [x] 设计 session 级模型连接配置字段：如 `base_url`
- [x] 设计安全引用方式：如 `api_key_env_var`
- [x] 明确哪些 provider 支持会话级覆盖，哪些仍走全局环境变量
- [x] 验证不同 session 指向不同模型网关时互不干扰

### workflow 运行控制

- [x] 为 workflow 设计取消 / 终止接口
- [x] 明确 run 状态机，避免只有 `queued/running/completed/error`
- [x] 强化 planner 计划与 run 结果之间的关联字段
- [x] 评估 workflow run 持久化与恢复的后续约束

### P1 Smoke

- [x] 验证带 `output_extractor` 的子代理能返回稳定压缩结果
- [x] 验证嵌套 `response_format` 可生成并完成一次真实回复
- [x] 验证两个 session 使用不同模型端点时能并行工作
- [x] 验证 workflow run 可被取消，且查询接口状态正确

## P2：平台化与通用宿主能力

### 工具宿主层

- [x] 盘点当前固定 `tool_map` 与 Motus 原生 tool 能力的差距
- [x] 设计更通用的 Python tool 注册机制
- [x] 设计工具分组、发现、启用策略
- [x] 保留 Motus 原生 tool 元信息，不把工具过度收窄为项目私有配置

### workflow 宿主层

- [x] 评估当前静态 `WORKFLOW_REGISTRY` 的扩展瓶颈
- [x] 设计外部 workflow 定义的装载方式
- [x] 设计动态注册后的统一查询与执行入口
- [x] 明确 workflow run 的长期持久化与重启恢复策略

### 第三方 framework 评估

- [x] 梳理 Motus 文档里提到的第三方 agent framework 宿主能力
- [x] 判断是否需要接 OpenAI Agents SDK 宿主层
- [x] 判断是否需要接 Google ADK 宿主层
- [x] 给出“接 / 不接 / 暂缓”的明确结论与理由
  - 结论：当前阶段统一暂缓接入 OpenAI Agents SDK 与 Google ADK 宿主层。
  - 理由：本项目现有 `ReActAgent + SessionBackend + 动态 tool/workflow host` 已覆盖当前产品需求；若引入第三方宿主，会显著增加状态模型、工具协议和 tracing 适配成本，但暂时没有明确业务收益。

### P2 Smoke

- [x] 验证挂入一个新工具后，可通过统一配置启用并实际调用
- [x] 验证新增一个外部 workflow 后，可通过统一 API 列出并执行
- [x] 验证服务重启后，工具注册状态与 workflow run 持久化不互相打架

## 收尾项

- [x] 每完成一个优先级阶段，更新 `docs/motus-backend-p0-p2-smoke.md`
- [x] 全部完成后，回写 `README.md` 与 `docs/开发文档.md`
- [x] 全部完成后，重新评估是否还需要新增 `P3`
  - 结论：暂不新增 `P3`。下一轮优先级应转向“真实远端 provider 联调”和“WebUI 对动态宿主能力的结构化编辑器接入”。
