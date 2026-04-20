---
name: skill_creator
description: Create or update project skills using a deterministic scaffold + materialize + validate workflow. Use when the user wants a new skill, wants to revise an existing skill, or asks the agent to self-bootstrap new capabilities.
---

# skill_creator

当用户需要：

- 新增一个项目内 skill
- 更新或重写已有 skill
- 让 agent 自举出新的技能能力
- 规范化 skill 目录结构

优先加载这个 skill。

## 推荐流程

1. 先确定 skill 名称、用途、触发场景、依赖工具、关键约束
2. 用 `scripts/init_skill.py` 创建标准目录骨架
3. 准备一个结构化 spec JSON
4. 用 `scripts/materialize_skill.py` 生成 `SKILL.md` 和 `reference.md`
5. 用 `scripts/quick_validate.py` 做快速校验
6. 如果需要，再做少量定制化修改，而不是从零手写整份文件

## 关键约束

- 当前项目的 skill 目录统一放在 `skills/`
- skill 名称使用小写 snake_case
- `SKILL.md` 保持短小，只写触发条件、推荐流程、关键约束
- 长示例、详细参数、背景知识放进 `reference.md`
- 不要为 skill 额外创建 README、CHANGELOG 一类冗余文件

## 参考资料

详细 spec 结构、脚本参数和示例见同目录的 `reference.md`
