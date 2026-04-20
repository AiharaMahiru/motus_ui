# Contributing

感谢参与 Motus Agent 项目。提交前请先确认改动范围清晰、可测试、不会泄露本地运行数据。

## 开发流程

1. 复制 `.env.example` 为 `.env`，只在本地填写真实密钥。
2. 使用 `uv sync` 安装 Python 依赖。
3. 使用 `cd web && npm install` 安装 WebUI 依赖。
4. 修改代码时优先保持模块小而清晰，避免把业务逻辑塞回页面级组件或 API 总入口。
5. 提交前运行与改动相关的 smoke 或测试命令。

## 推荐验证

```bash
uv run pytest
uv run python -m py_compile apps/*.py core/**/*.py tools/**/*.py scripts/**/*.py
cd web
npm run build
npm run test
```

## 代码规范

- Python 使用 4 空格缩进、类型标注和明确的 schema。
- React 组件优先拆分到 feature 目录，图标默认使用 `lucide-react`。
- 注释保持简洁，优先解释状态机、异步流、SDK 适配和成本计算等非显然逻辑。
- 不提交兼容性废代码、临时日志、调试截图和运行产物。

## Pull Request 要求

- 描述问题、方案、影响范围和验证结果。
- 涉及 API、SSE、环境变量或数据结构时，说明兼容性影响。
- WebUI 改动请附截图或说明已覆盖的主题、语言和视口。
- 后端改动请附示例请求、响应或 smoke 记录。

## 安全要求

不要提交 `.env`、真实 API Key、会话日志、上传文件、预览输出、trace 产物或发布压缩包。公开发布前请执行 `docs/open-source-release-checklist.md`。
