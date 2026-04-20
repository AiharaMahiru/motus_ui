# 真实 HITL WebUI 联调 P0-P3 矩阵

## 目标

在已有真实 HITL API 联调通过的基础上，把 WebUI 补齐到“页面真实创建 HITL 会话、等待 interrupt、提交 resume、拿到最终回复”的闭环，并沉淀为可复跑的 Playwright 与 smoke 脚本。

## P0：WebUI 真实 HITL 配置能力补齐

状态：已完成

- 会话配置面板补齐 HITL 真实联调所需入口：
  - 暴露 `ask_user_question`
  - 暴露 `human_in_the_loop`
  - 暴露 `approval_tool_names`
- 增加最小 HITL 预设：
  - `问答 HITL`
  - `审批 HITL`
- 为关键控件补 `data-testid`，确保浏览器自动化稳定。

### P0 验收

- WebUI 可通过右侧面板创建一个带 `ask_user_question` 的真实 HITL 会话。
- WebUI 可通过右侧面板创建一个带 `bash approval` 的真实 HITL 会话。

## P1：真实页面联调用例

状态：已完成

- 增加真实 Playwright 用例：
  - `user_input interrupt -> resume -> idle`
  - `tool_approval interrupt -> resume -> idle`
- 用例真实调用后端，不 mock interrupt。
- 用例支持通过环境变量注入已探测到的可用模型。

### P1 验收

- 浏览器页面内能看到 interrupt 卡片并完成提交。
- 最终消息中能看到专用 token，证明不是假通过。

## P2：真实 WebUI smoke 脚本

状态：已完成

- 新增 `scripts/smoke/hitl_real_webui.py`
- 脚本负责：
  - 自动探测真实可用模型
  - 拉起 HITL server、统一 API、Vite
  - 执行真实 Playwright 用例
  - 输出日志、结果 JSON、结果文档

### P2 验收

- 一条命令可重放真实 HITL WebUI 联调。
- 文档内能看到模型、会话、interrupt 类型、最终回复与日志位置。

## P3：回归体系接入

状态：已完成

- 把真实 HITL WebUI smoke 作为“可选但正式”的系统级 smoke 项。
- 默认 `run_all` 不自动执行，避免无意消耗外部模型费用。
- 当设置专用环境变量时，`run_all` 自动纳入真实 HITL WebUI smoke。

### P3 验收

- `SMOKE_INCLUDE_REAL_HITL_WEBUI=1 uv run python -m scripts.smoke.run_all` 可把该项纳入系统回归。
- 默认 `run_all` 行为不受影响。
