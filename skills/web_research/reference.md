# web_research reference

## 可用工具

### `web_search(query: str) -> dict`

适合：

- 查找候选网页
- 获取多来源入口
- 不确定目标页面在哪

### `web_scrape(url: str, params: dict | None) -> dict`

适合：

- 抓取指定页面
- 提取正文
- 对页面执行简单 actions

`params` 可包含类似：

```json
{
  "actions": [
    {"type": "click", "selector": "#next"},
    {"type": "wait", "milliseconds": 1000}
  ]
}
```

### `web_interact(scrape_id: str, prompt: str | None, code: str | None, language: str | None) -> dict`

适合：

- 在已有 scrape 会话上继续操作
- 用自然语言描述下一步动作
- 或在页面上下文里执行代码

## 实用策略

### 搜索型任务

先：

1. `web_search`
2. 选出最可信来源
3. `web_scrape`
4. 再总结

### 单页面任务

如果用户已经给了 URL：

1. 直接 `web_scrape`
2. 如结果不完整，再加 actions 或 `web_interact`

### 交互型页面

如果页面需要：

- 点击“下一页”
- 展开折叠内容
- 等待异步加载

优先：

1. `web_scrape(..., params={"actions": [...]})`
2. 不够时再 `web_interact`

## 常见问题

### 没有配置 `FIRECRAWL_KEY`

工具会直接报错，这时应先提示环境配置缺失。

### 一次抓取结果不完整

可能原因：

- 页面是动态加载
- 需要滚动或点击
- 需要等待异步渲染

此时应改用 actions 或交互工具。
