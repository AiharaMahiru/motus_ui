# Skills Directory

这个目录是项目内 **运行时技能入口**。

与 `tools/integrations/` 的区别：

- `skills/`
  面向 agent 运行时，通过 `load_skill` 按需加载
- `tools/integrations/`
  面向实现层和维护者，保存工具代码与实现参考资料

## 当前技能

### 1. `web_research`

路径：

- `skills/web_research/SKILL.md`
- `skills/web_research/reference.md`

适用场景：

- 搜索网页资料
- 抓取页面内容
- 与动态网页继续交互
- 先搜索再总结

### 2. `office_documents`

路径：

- `skills/office_documents/SKILL.md`
- `skills/office_documents/reference.md`

适用场景：

- 创建或修改 `.docx`
- 创建或修改 `.xlsx`
- 创建或修改 `.pptx`
- 使用 `office_cli` 做批量文档操作

### 3. `skill_creator`

路径：

- `skills/skill_creator/SKILL.md`
- `skills/skill_creator/reference.md`
- `skills/skill_creator/scripts/`

适用场景：

- 新增项目内 skill
- 更新已有 skill
- 让 agent 自举出新的 skill 能力
- 规范化 skill 目录结构

### 4. `canvas_preview`

路径：

- `skills/canvas_preview/SKILL.md`
- `skills/canvas_preview/reference.md`

适用场景：

- 生成可直接预览的单文件 HTML / React / Python demo
- 快速验证简单界面、小组件、小游戏或可视化
- 约束 agent 输出“能渲染”的轻量预览代码，而不是项目级工程

### 5. `inline_visualization`

路径：

- `skills/inline_visualization/SKILL.md`
- `skills/inline_visualization/reference.md`

适用场景：

- 先做数据分析，再在会话中内嵌图表增强表达
- 在回答中嵌入 `mermaid` 流程图、状态图、时序图
- 在回答中嵌入 `viz` 趋势图、柱状图、面积图、饼图、环形图
- 约束 agent 输出当前 WebUI 真正支持的可视化语法，而不是伪格式

## 第三方技能来源

当前项目还接入了一批 **vendored 第三方 skills**：

- 来源仓库：`MiniMax-AI/skills`
- vendored 路径：`vendor/minimax-skills/`
- 运行时入口：通过 `skills/` 下的一级软链接暴露给 `load_skill`

这样做的原因是：

1. 保持第三方源码有独立来源，方便后续更新
2. 保持当前项目的 `skills/` 仍然是统一运行时入口
3. 不需要改 `load_skill` 的发现逻辑

在实际使用这些 skill 之前，请先查看：

- `docs/runtime-requirements.md`

因为其中一部分是执行型 skill，缺少对应运行时时只会加载说明，不能真正完成执行动作。

当前已接入的 MiniMax skills 包括：

- `android-native-dev`
- `buddy-sings`
- `flutter-dev`
- `frontend-dev`
- `fullstack-dev`
- `gif-sticker-maker`
- `ios-application-dev`
- `minimax-docx`
- `mmx-cli`
- `minimax-music-gen`
- `minimax-music-playlist`
- `minimax-pdf`
- `minimax-xlsx`
- `pptx-generator`
- `react-native-dev`
- `shader-dev`
- `vision-analysis`

注意：

- 源目录 `vendor/minimax-skills/skills/minimax-multimodal-toolkit/`
  在运行时加载出来的 skill 名字是 `mmx-cli`
  因为它的 `SKILL.md` frontmatter 中定义的是 `name: mmx-cli`

## 设计约束

每个 skill 目录都遵循：

- `SKILL.md`
  只保留短说明：触发条件、推荐流程、关键约束
- companion files
  例如 `reference.md`，存放长示例、详细参数、常见问题

## 维护建议

新增 skill 时建议：

1. 先定义触发场景
2. 保持 `SKILL.md` 简短
3. 长说明下沉到 companion files
4. 通过 `load_skill` 验证是否能被正常加载
