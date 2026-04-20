# 开源整理审计记录

审计时间：2026-04-20

## 已完成

- 根 `.gitignore` 已覆盖 `.env`、`.env.*`、`runtime/`、`release/`、`.venv/`、`node_modules/`、`web/dist/`、`web/coverage/`、`web/test-results/`、`*.egg-info/`、`__pycache__/`、`*.pyc` 和本地任务 scratch 文件。
- 已新增 `.env.example`，只保留环境变量名和空值。
- 已重写根 `README.md`，压缩为开源入口文档。
- 已新增 `CONTRIBUTING.md`、`SECURITY.md` 和 `docs/open-source-release-checklist.md`。
- 已把 `pyproject.toml` 的占位描述改为项目描述，包名改为 `motus-agent-workbench`。

## 敏感信息扫描

扫描范围排除了 `vendor/`、`runtime/`、`release/`、`node_modules/`、`web/node_modules/` 和 `.venv/`。

发现结果：

- `.env` 内存在真实 `OPENAI_API_KEY` 与 `FIRECRAWL_KEY`，但 `.gitignore` 已明确忽略。
- 源码与文档中只发现示例占位值，例如 `OPENAI_API_KEY=...`、`FIRECRAWL_KEY=...` 和测试用 `test-key`。
- `web/dist/` 和 `agent.egg-info/` 含有构建后的旧内容，开源时不应提交。

## 本地运行产物

当前工作区包含较多本地运行数据：

- `runtime/conversation_logs/`
- `runtime/sessions/`
- `runtime/hitl_sessions/`
- `runtime/workflow_runs/`
- `runtime/traces/`
- `runtime/uploads/`
- `runtime/output/`
- `runtime/smoke/`
- `runtime/ui-acceptance-20260420/`
- `release/agent-source-20260417-015448.zip`
- `web/dist/`
- `web/coverage/`
- `web/test-results/`
- `agent.egg-info/`
- `motus_agent_workbench.egg-info/`
- 多处 `__pycache__/` 和 `*.pyc`

这些文件可能包含会话内容、调试截图、trace 元数据、上传文件或本地构建结果，默认不要公开。

## 建议清理但未执行

以下清理会删除本地缓存、构建产物和运行记录，需确认后再执行：

```bash
find . -type d -name __pycache__ -prune -exec rm -rf {} +
find . -type f -name '*.pyc' -delete
rm -rf *.egg-info node_modules web/node_modules web/dist web/coverage web/test-results release
```

如果要清空全部本地运行数据，再额外执行：

```bash
rm -rf runtime
```

执行 `rm -rf runtime` 前必须确认不需要保留会话、上传文件、预览产物、截图和 smoke 记录。

## 发布前待确认

- 选择并添加正式 `LICENSE`。
- 确认是否公开 `vendor/minimax-skills/`，以及它的许可证兼容性。
- 确认是否保留历史规划类文档，或迁移到 `docs/archive/`。
- 确认是否需要公开示例截图；如需要，应先脱敏并移动到 `docs/assets/`。

## 验证结果

2026-04-20 已执行：

- `uv run python -m py_compile apps/*.py core/**/*.py tools/**/*.py scripts/**/*.py`：通过。
- `uv run pytest`：通过，70 passed，1 个第三方 `google.genai` deprecation warning。
- `cd web && npm run build`：通过，保留 Vite 大 chunk 警告。
- `cd web && npm run test`：通过，25 个 test files / 64 tests passed。测试期间 jsdom 提示 `HTMLCanvasElement.getContext()` 未实现，不影响退出码。

本次还补充了 `pytest` dev 依赖并更新 `uv.lock`，确保 README 中的测试命令可直接执行。
