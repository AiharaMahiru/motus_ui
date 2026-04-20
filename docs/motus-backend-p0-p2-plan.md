# Motus 后端特性补齐路线图

## 目标

基于当前项目已经接入的 Motus 主链路能力，继续把后端从“可用的产品实现”补齐为“更稳定、更统一、更接近官方语义的宿主层”。

这份路线图只关注 **增量缺口**，不重复列已经完成的能力。

对应执行清单见：[Motus 后端 P0-P2 TODO](/opt/Agent/docs/motus-backend-p0-p2-todo.md)
对应 smoke 记录见：[Motus 后端 P0-P2 Smoke 记录](/opt/Agent/docs/motus-backend-p0-p2-smoke.md)

## 当前完成状态

截至 2026-04-19，本路线图中的 P0 / P1 / P2 已完成首轮落地：

- P0：统一消息 payload、本地与 HITL 状态修正、HITL 不可恢复标志
- P1：多代理 `output_extractor`、嵌套 `response_format`、session 级模型客户端覆盖、workflow cancel / terminate
- P2：动态工具宿主、动态 workflow 宿主、统一 runtime catalog，第三方 framework 宿主结论暂缓

当前更适合把这份文档视为“已执行路线 + 后续维护基线”，而不是待立项草案。

## 当前基线

当前后端已经具备下列能力：

- 会话级 `ReActAgent` 配置：provider、model、thinking、`cache_policy`、`max_steps`、timeout
- builtin tools、`load_skill`、工具审批、MCP、本地/云端 sandbox
- `basic / compact` memory 与历史恢复
- 多代理主管/专家树与 usage/cost 聚合
- workflow 注册、planning、运行、超时、重试、trace
- tracing 的 runtime / session / workflow 视图
- 独立 HITL server、interrupt / resume、运行中 telemetry、统一 Web API 接入

结论：当前不是“未适配 Motus”，而是 **主能力已接入，但仍有若干官方 SDK 高级面与原生语义没有完整暴露**。

## 优先级原则

- P0：直接影响正确性、恢复性、官方语义一致性
- P1：影响扩展性、编排能力、复杂任务表达力
- P2：影响平台化与通用宿主化，但不阻塞当前产品交付

## P0：统一语义与恢复能力

### 目标

优先补齐会导致“前端误判”、“状态卡死”、“接口语义不一致”的缺口。

### 范围

- 补齐统一 API 与 Motus Sessions / Messages 官方语义的主要差异：
  - 统一消息请求体的扩展字段能力
  - 本地 backend 对非字符串 `content`、`user_params`、图片消息的兼容能力
  - 保持 `wait=true`、202 异步派发、stream 三种模式语义稳定
- 补齐 HITL 跨重启恢复策略：
  - 至少要做到可诊断、可重试、前端不误导
  - 明确哪些 interrupt 可继续、哪些只能回滚并重新发起
- 统一本地 backend 与 HITL backend 的会话状态修正逻辑，避免“running 永不结束”
- 统一会话 telemetry 的输出口径，确保 running / interrupted / error 时 usage、cost、context window 都可读

### 验收标准

- 同一前端请求体，在 `local / hitl` 两种 backend 下语义尽量一致
- 服务异常退出后，会话不会永久停在 `running`
- HITL 会话在不可恢复时，UI 与接口明确给出不可恢复状态，而不是伪恢复
- usage / cost / context telemetry 在 SSE 与轮询查询中保持一致

### P0 Smoke

- 本地 backend 提交带 `user_params` 的消息后不报协议错误
- 运行中会话在超时或任务退出后自动转为 `idle / error`
- HITL 会话在服务重启后返回稳定状态，不出现“前端可 resume、后端拒绝”的假闭环
- `/api/sessions/{id}?wait=true`、`/messages?wait=false`、`/messages/stream` 三条链路都能复跑

## P1：高级编排与复杂输出能力

### 目标

把当前“够用”的 Motus 接入升级成“适合复杂 agent 编排”的后端层。

### 范围

- 补齐多代理高级能力暴露：
  - 子代理 `output_extractor`
  - 更细粒度的子代理工具参数
  - 更清晰的 stateful / fork 语义控制
- 放宽当前受限的 `response_format`：
  - 支持嵌套对象
  - 支持更丰富的数组 / 可选字段 / 结构组合
  - 保持前后端共享 schema，而不是退回任意 Python 类
- 增加会话级模型客户端覆盖能力：
  - session 级 `base_url`
  - session 级 `api_key_env_var` 或等价安全引用
  - 便于多供应商、多租户、多模型路由
- 对 workflow 补齐更清晰的运行控制：
  - 取消 / 终止
  - 更细粒度状态
  - 更明确的 planner 结果与运行结果关联

### 验收标准

- 多代理编排不再局限于“普通专家工具调用”
- 结构化输出能覆盖复杂抽取与多层结果
- 不同 session 可安全地指向不同模型网关或凭据
- workflow 不只是“能跑”，还具备基本治理能力

### P1 Smoke

- 带 `output_extractor` 的子代理能返回被压缩后的稳定结果
- 嵌套 `response_format` 能生成并通过一次真实结构化回复
- 两个 session 使用不同模型端点时能各自完成对话
- workflow run 可被取消，并稳定反映到查询接口

## P2：平台化与通用宿主能力

### 目标

补齐“通用 Motus 平台”所需，但对当前产品不是硬阻塞的能力。

### 范围

- 把当前固定 `tool_map` 提升为更通用的工具宿主层：
  - 可注册更多 Python callable tool
  - 支持更灵活的工具分组与发现
  - 更好地保留 Motus 原生 tool 元信息
- 把 workflow 从“项目内置注册表”升级为“可扩展宿主”：
  - 动态注册 / 装载
  - 更通用的任务图声明
  - 更长期的 run 持久化与恢复策略
- 评估是否需要接入 Motus 文档中提到的第三方 agent framework 宿主面：
  - OpenAI Agents SDK
  - Google ADK
  - 其他官方支持的 agent framework

### 验收标准

- 后端不再强依赖当前项目内置工具和 workflow 清单
- 可以在不改主链路 API 的前提下挂入新的工具包或 workflow 包
- 是否接第三方 framework 有明确结论，而不是长期悬空

### P2 Smoke

- 动态挂入一个新工具后，可在会话配置中启用并实际调用
- 新增一个外部 workflow 定义后，可通过统一 API 列出并执行
- 服务重启后，平台级注册结果与持久化 run 不错乱

## 明确暂缓项

这些能力目前不是必须，除非项目目标从“Agent 产品后端”切换到“通用 Motus 平台”：

- 完整镜像 Motus 全部内部 wire protocol
- 暴露任意 Python 级底层 runtime hook 给前端
- 无边界开放任意 Python 模型类作为 `response_format`
- 为所有第三方 agent framework 做一层统一宿主

## 建议实施顺序

1. 先做 P0，优先修语义一致性和恢复性
2. 再做 P1，把复杂编排和复杂输出补齐
3. 最后评估 P2，只补真正会被用到的平台化能力

## 里程碑退出条件

- P0 完成后：当前 WebUI / 后续 Tauri 前端都能稳定依赖统一会话接口，不再被 backend 模式差异反复绊住
- P1 完成后：后端足以承载更复杂的多代理编排、结构化输出和模型路由
- P2 完成后：后端才算具备“更通用的 Motus 宿主平台”雏形
