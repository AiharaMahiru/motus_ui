# canvas_preview reference

## Suggested Tools

- load_skill
- write_file
- edit_file
- read_file

## 适用范围

- 目标是“几秒内可验证”的预览，不是正式工程交付
- 适合：
  - 单文件小游戏
  - 单卡片 UI / 简单页面
  - 小型交互组件
  - 简单图表或算法可视化
- 不适合：
  - 多页面应用
  - 复杂状态管理
  - 后端 API / 数据库 / 登录
  - 需要多文件工程结构的真实项目

## 语言选择

- 默认优先 `HTML`
  - 最稳，失败面最小
  - 适合简单页面、小游戏、动画、表单、图表
- 用户明确要求 `React` 时才用 `React`
  - 只生成一个默认导出组件
  - 不引入第三方包
  - 不拆文件
- 用户明确要求 `Python` 时才用 `Python`
  - 优先 `print()` 完整 HTML
  - 或写出 `preview.html` / `preview.svg` / `preview.png`
  - 只用标准库

## HTML 规则

- 必须输出完整文档：`<!doctype html>` + `<html>` + `<head>` + `<body>`
- CSS 和 JS 全部内联
- 不使用 CDN、外链字体、外链图片、外部接口
- 初始就要有可见内容，不要空白页
- 如果需要交互，默认使用原生 DOM API，不要引入框架

## React 规则

- 默认导出 `App`
- 不依赖任何第三方库，只允许 `react` / `react-dom`
- 不要写 `npm install`、`package.json`、路由、状态库、构建说明
- 尽量用内联样式或简单对象样式，减少额外 CSS 依赖
- 必须保证渲染后立刻有可见内容

推荐骨架：

```tsx
export default function App() {
  return <main style={{ padding: 24 }}>Hello Preview</main>
}
```

## Python 规则

- 只用标准库
- 优先：

```python
print("""<!doctype html><html><body><main>Hello Preview</main></body></html>""")
```

- 如果要输出文件，优先写到当前目录的：
  - `preview.html`
  - `preview.svg`
  - `preview.png`
- 不要写常驻 server、无限循环、终端交互、curses、watcher
- 不要依赖 `pip install`

## 明确禁止

- 多文件 React 项目骨架
- `import xxx from "npm-package"` 之类第三方依赖
- 外部资源 URL
- 长时运行进程
- 需要人工额外补文件才能显示结果的代码
- 项目级架构、目录树、部署说明伪装成“预览代码”

## 输出前自检

- 是否单文件可运行
- 是否有明确入口
- 是否一打开就有可见结果
- 是否避免了第三方依赖
- 是否属于“快速验证”而不是“正式工程”

## 降级策略

- `React` 方案不稳时，降级成 `HTML`
- `Python` 如果只是做静态可视化，优先直接打印 HTML/SVG
- 用户需求过大时，明确说明“这个 skill 不适用”，然后转回正常实现路线
