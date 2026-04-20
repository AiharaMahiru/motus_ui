# Motus 后端 P0-P2 Smoke 记录

## P0

- `uv run python -m py_compile apps/*.py core/**/*.py tools/**/*.py tests/*.py`
  - 结果：通过
- `uv run python -m unittest tests.test_motus_p0_runtime tests.test_session_runtime tests.test_hitl_server_recovery tests.test_api_session_backend tests.test_hitl_backend`
  - 结果：30 个测试全部通过
  - 覆盖点：
    - 本地 backend 新增 `run_turn_message / dispatch_turn_message`
    - 本地会话支持 `content / user_params / base64_image / files`
    - 本地模式下 `webhook` 显式拒绝
    - 本地 stale running 自动转 `error`
    - HITL 重启后 `resume_supported=false`，不会出现伪 resume
    - `wait=true`、202 异步派发、SSE stream 三条链路可复跑

## P1

- `uv run python -m unittest tests.test_motus_p1_model_config`
  - 结果：7 个测试全部通过
  - 覆盖点：
    - session 级 `model_client.base_url / api_key_env_var`
    - 嵌套 `response_format`
    - `output_extractor` 字段抽取
    - agent `cache_policy / response_format` 挂载

## P2

- `uv run python -m unittest tests.test_motus_p2_runtime tests.test_workflow_service tests.test_system_service`
  - 结果：13 个测试全部通过
  - 覆盖点：
    - 动态工具插件装载与调用
    - 动态 workflow 插件装载、执行与重启后恢复
    - workflow cancel / terminate 状态治理
    - workflow retry / timeout / planner 元信息持久化

## 回归补充

- `uv run python -m unittest tests.test_motus_p0_runtime tests.test_motus_p1_model_config tests.test_motus_p2_runtime tests.test_session_runtime tests.test_session_update tests.test_workflow_service tests.test_api_session_backend tests.test_hitl_backend tests.test_hitl_server_recovery tests.test_system_service`
  - 结果：51 个测试全部通过
  - 说明：覆盖了本轮 P0-P2 改造以及 session/workflow/HITL/system 关键回归路径
