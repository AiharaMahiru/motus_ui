# 开源发布检查清单

本文档用于把当前项目整理到可公开发布状态。默认不提交运行数据、密钥、构建产物和本地缓存。

## 必须确认

- 根仓库许可证固定为 `Apache-2.0`，并与 `README.md`、包元数据保持一致。
- `.env` 只保留在本地，公开仓库仅提交 `.env.example`。
- `runtime/`、`release/`、`web/dist/`、`web/coverage/`、`web/test-results/` 不进入开源仓库。
- `node_modules/`、`web/node_modules/`、`.venv/`、`*.egg-info/`、`__pycache__/` 不进入开源仓库。
- 会话日志、截图、预览产物和真实 provider 联调结果属于运行产物，默认不公开。
- 若需要公开示例截图或 smoke 结果，应先脱敏并移动到 `docs/assets/` 或单独的示例目录。
- `vendor/minimax-skills/` 是第三方子模块，发布时要确认 submodule 地址、上游可访问性和许可证说明。

## 建议保留

- `apps/`、`core/`、`scripts/`、`skills/`、`tools/`、`web/src/`。
- `tests/` 中的单元测试和 smoke 测试入口。
- `docs/` 中面向贡献者的开发说明、架构说明、前端接入说明和运行时依赖说明。
- `uv.lock` 与 `web/package-lock.json`，用于复现依赖版本。

## 发布前验证

```bash
uv sync
uv run pytest
uv run python -m py_compile apps/*.py core/**/*.py tools/**/*.py scripts/**/*.py
cd web
npm install
npm run build
npm run test
```

## 可选清理命令

以下命令会删除本地缓存和构建产物，执行前确认不需要保留相关运行记录。

```bash
find . -type d -name __pycache__ -prune -exec rm -rf {} +
find . -type f -name '*.pyc' -delete
rm -rf agent.egg-info node_modules web/node_modules web/dist web/coverage web/test-results
```

不要默认删除 `runtime/`，其中可能包含用户会话、上传文件、预览产物和调试截图。
