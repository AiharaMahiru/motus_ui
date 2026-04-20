---
name: canvas_preview
description: Produce self-contained HTML, React, or Python preview code for quick in-app rendering when the user wants a simple demo, toy UI, or fast visual verification rather than a full project.
---

# canvas_preview

当用户需要：

- 写一个单文件 HTML/React/Python 小 demo
- 快速验证一个简单界面、小游戏、交互组件或算法可视化
- 直接在当前会话里运行预览代码，而不是搭完整项目
- 修正一段“本来想预览，但无法渲染”的简单代码

优先加载这个 skill。

## 推荐流程

1. 先判断用户目标是否属于“简单、单文件、可快速验证”的预览任务
2. 在 `HTML / React / Python` 中选最稳的一种；没有明确要求时优先 `HTML`
3. 生成自包含代码，并按预览运行约束主动规避外部依赖、多文件结构和长链路启动
4. 输出前自检：语法是否完整、入口是否明确、是否能直接渲染出可见结果
5. 如果用户要的是项目级页面、复杂工程、后端联动或多文件应用，明确不要套用这个 skill

## 关键约束

- 这个 skill 只适用于“简单、快速验证”的代码预览，不适用于项目级实现
- `HTML` 必须单文件自包含，样式和脚本内联，不依赖 CDN 和外部资源
- `React` 必须是单文件组件预览：默认导出 `App`，不引入第三方包，不拆多文件
- `Python` 必须使用标准库；优先直接打印完整 HTML/SVG，或写出 `preview.html` / `preview.svg` / `preview.png`
- 不要输出需要长期运行的 server、终端交互程序、文件监听器、数据库、认证流程或复杂构建链
- 代码必须能在当前预览能力下快速看到结果；如果做不到，要主动降级为更简单的实现

## 参考资料

详细内容见同目录的 `reference.md`
