---
name: inline_visualization
description: Use Python for data analysis and embed Mermaid or viz charts directly in chat when diagrams improve clarity, explanation quality, or decision support.
---

# inline_visualization

当用户需要：

- 做数据分析、趋势判断、对比分析、占比分析、分布分析
- 解释流程、架构、状态机、时序、排查路径、决策分支
- 让回答更直观，而不是只给大段文字

优先加载这个 skill。

## 推荐流程

1. 先判断这是“数据可视化”还是“结构 / 流程可视化”
2. 如果是数据分析：
   - 必要时先用 Python 做清洗、聚合、统计和派生指标
   - 只保留最有信息量的 1 到 3 张图，不堆砌
   - 最终把图表转成会话内嵌 `viz` 代码块，而不是直接丢 Python 绘图库源码
3. 如果是流程、结构、关系说明：
   - 用 `mermaid` 代码块输出流程图、状态图、时序图、ER 图、架构图、甘特图、思维导图等
4. 图前先给一句结论，图后再给 2 到 4 条简洁解读
5. 如果图不能提升表达，或者数据证据不足，不要强行画图

## 关键约束

- 当前会话内嵌渲染主通道只有两类：
  - ` ```mermaid `：流程 / 结构 / 关系图
  - ` ```viz `：结构化图表 JSON
- Python 用于分析和提炼数据，不用于把 matplotlib / seaborn / plotly 源码直接塞进最终回答
- `viz` 必须是合法 JSON，不要输出 JS 对象、单引号、注释、尾逗号
- 当前 `viz` 只支持：
  - `line`
  - `bar`
  - `area`
  - `pie`
  - `doughnut`
-   - `scatter`
-   - `radar`
-   - `heatmap`
-   - `funnel`
-   - `gauge`
-   - `sankey`
-   - `candlestick`
- 当前 `mermaid` 必须使用官方语法；优先选择标准图种，不要自造 DSL
- 适合架构 / 算法 / 拓扑 / 分层说明时，优先考虑 `flowchart`、`block-beta`、`architecture-beta`、`sequenceDiagram`、`stateDiagram-v2`
- 单轮回答默认不超过 3 张图；如果信息很多，优先“1 张总览图 + 几条解读”
- 如果用户明确要高保真文件、长篇分析看板、导出图像或复杂单文件预览，再考虑配合 `canvas_preview`

## 参考资料

详细 schema、模板、常见错误和输出范式见同目录的 `reference.md`
