---
name: web_research
description: Search, scrape, and interact with websites when the task requires online information gathering, page extraction, or multi-step browser interaction.
---

# web_research

当用户需要：

- 搜索网页资料
- 抓取某个页面内容
- 与网页进行后续交互
- 先搜索再整理结论

优先加载这个 skill。

## 推荐流程

1. 先判断是“搜索”还是“直达页面抓取”
2. 用 `web_search` 做入口发现
3. 用 `web_scrape` 获取目标页面内容
4. 如果页面需要继续点选或翻页，再用 `web_interact`
5. 最后再整理为面向用户的结果

## 关键约束

- 需要 `FIRECRAWL_KEY`
- 搜索适合找来源，抓取适合拿正文
- 交互只在 scrape 后的会话上下文里做
- 如果页面是动态的，不要只靠一次抓取就下结论

## 参考资料

详细参数、工具说明、示例命令见同目录的 `reference.md`
