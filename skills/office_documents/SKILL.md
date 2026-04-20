---
name: office_documents
description: Create, inspect, and modify Word, Excel, and PowerPoint documents through office_cli when the task involves .docx, .xlsx, or .pptx files.
---

# office_documents

当用户需要：

- 创建 Word / Excel / PowerPoint 文件
- 读取 Office 文档结构
- 修改段落、表格、页脚、样式
- 批量编辑 Office 内容

优先加载这个 skill。

## 推荐流程

1. 先确认文件类型：`docx / xlsx / pptx`
2. 不确定命令时，先跑帮助，而不是猜参数
3. 小改动优先单条 `get / add / set`
4. 大批量改动优先 `batch`
5. 最后做 `validate`

## 关键约束

- `office_cli` 底层依赖 `officecli` 可执行文件
- 创建文件时不要盲目使用过期参数
- 修改前先读取目标节点，避免路径猜错
- 大文档优先局部读取，不要一次输出过多内容

## 参考资料

详细命令、路径规则、批量操作说明见同目录的 `reference.md`
