# WebUI P0-P3 Smoke 结果

日期：2026-04-18

## P0：contracts 与能力探测

### 变更范围

- `web/src/shared/api/contracts.ts`
- `web/src/features/meta/components/MetaPanel.tsx`
- `web/src/features/chat/pages/ChatPage.tsx`

### Smoke 命令

```bash
cd /opt/Agent/web
npm exec vitest run \
  src/shared/api/contracts.test.ts \
  src/features/meta/components/MetaPanel.test.tsx \
  src/features/sessions/constants.test.ts \
  src/features/chat/components/ComposerConfigBar.test.tsx
npm run build
```

### 结果

- 相关测试通过
- `npm run build` 通过

## P1：Session 新字段与高级配置面板

### 变更范围

- `web/src/features/sessions/constants.ts`
- `web/src/features/sessions/components/SessionConfigPanel.tsx`
- `web/src/features/sessions/components/SessionConfigEditors.tsx`
- `web/src/features/chat/components/ComposerConfigBar.tsx`

### Smoke 命令

```bash
cd /opt/Agent/web
npm exec vitest run \
  src/features/sessions/constants.test.ts \
  src/features/sessions/components/SessionConfigPanel.test.tsx \
  src/features/chat/components/ComposerConfigBar.test.tsx
npm run build
```

### 结果

- 相关测试通过
- `npm run build` 通过

## P2：Workflow runtime

### 变更范围

- `web/src/features/workflows/api.ts`
- `web/src/features/workflows/pages/WorkflowPage.tsx`
- `web/src/features/workflows/components/WorkflowWorkspace.tsx`

### Smoke 命令

```bash
cd /opt/Agent/web
npm exec vitest run \
  src/shared/api/contracts.test.ts \
  src/features/workflows/components/WorkflowWorkspace.test.tsx
npm run build
```

### 结果

- 相关测试通过
- `npm run build` 通过

## P3：response_format / guardrails / MCP / memory 结构化编辑器

### 变更范围

- `web/src/features/sessions/components/SessionConfigEditors.tsx`
- `web/src/features/sessions/components/SessionConfigPanel.tsx`
- `web/src/features/sessions/constants.ts`

### Smoke 命令

```bash
cd /opt/Agent/web
npm exec vitest run \
  src/features/sessions/components/SessionConfigEditors.test.tsx \
  src/features/sessions/components/SessionConfigPanel.test.tsx \
  src/shared/api/contracts.test.ts
npm run build
```

### 结果

- 相关测试通过
- `npm run build` 通过

## 总回归

### 命令

```bash
cd /opt/Agent/web
npm exec vitest run
npm run build
```

### 结果

- `23` 个测试文件通过
- `50` 个测试用例通过
- 生产构建通过

### 备注

- 全量 vitest 输出中存在 `HTMLCanvasElement.getContext()` 的 jsdom 提示。
- 这是测试环境对 canvas 的已知限制提示，不影响本轮测试通过和 production build 成功。
