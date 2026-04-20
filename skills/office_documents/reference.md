# office_documents reference

## 适用范围

- `.docx`
- `.xlsx`
- `.pptx`

## 核心命令层级

### L1

- `create`
- `view`
- `get`
- `query`
- `validate`

### L2

- `set`
- `add`
- `remove`
- `move`
- `swap`
- `batch`

### L3

- `raw`
- `raw-set`
- `add-part`

## 推荐习惯

### 1. 不确定时先查帮助

例如：

```bash
officecli --help
officecli docx add --help
officecli batch --help
```

### 2. 创建文档

```bash
officecli create report.docx
officecli create data.xlsx
officecli create slides.pptx
```

### 3. 读取内容

```bash
officecli get report.docx /body --depth 2
officecli view report.docx outline
officecli validate report.docx
```

### 4. Word 常见写入

```bash
officecli add report.docx /body --type paragraph --prop text="Executive Summary"
officecli add report.docx / --type footer --prop text="第 " --prop field=page --prop alignment=center
```

### 5. 批量写入

适合：

- 一次写入多个段落
- 一次建立完整文档结构
- 减少多次单命令调用

## 路径和参数要点

- 路径优先使用返回结果里的稳定路径
- shell 中包含方括号的路径要注意引号
- `batch --commands` 传 JSON 时，优先保证 JSON 本身合法

## 验证

完成修改后建议执行：

```bash
officecli validate <file>
```

## 常见故障

### `officecli` 不存在

先确认安装：

```bash
officecli --version
```

### 参数不兼容

说明命令示例和本机版本不一致，此时应重新查询帮助。

### 批量命令失败

优先检查：

- JSON 是否合法
- 路径是否存在
- 属性名是否正确
