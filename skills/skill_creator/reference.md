# skill_creator reference

## 目标

这个 skill 的目标不是让 agent 每次都从空白开始写技能，而是把过程拆成：

1. 初始化目录
2. 准备 spec
3. 渲染文件
4. 校验结构

这样能显著降低 agent 自举时的随机性。

## 目录结构

标准 skill 目录：

```text
skills/<skill_name>/
├── SKILL.md
├── reference.md
└── scripts/
```

说明：

- `scripts/` 不是必须，但推荐保留，以便后续放确定性逻辑

## 命名约定

- 目录名：小写 snake_case
- frontmatter `name`：与目录名一致

## 推荐脚本链路

### 1. 初始化目录

```bash
python skills/skill_creator/scripts/init_skill.py \
  --root skills \
  --name demo_skill
```

### 2. 准备 spec JSON

示例：

```json
{
  "name": "demo_skill",
  "description": "Generate a demo skill scaffold",
  "use_cases": [
    "Create a new project skill",
    "Bootstrap a missing capability"
  ],
  "flow": [
    "Inspect the request and decide whether this skill fits",
    "Load reference details only when needed",
    "Apply the skill workflow",
    "Return the final result"
  ],
  "constraints": [
    "Keep SKILL.md concise",
    "Put long examples in reference.md"
  ],
  "tools": [
    "write_file",
    "load_skill"
  ],
  "reference_sections": {
    "Overview": [
      "What this skill is for"
    ],
    "Examples": [
      "Add realistic examples here"
    ]
  }
}
```

### 3. 渲染文件

```bash
python skills/skill_creator/scripts/materialize_skill.py \
  --root skills \
  --name demo_skill \
  --spec /abs/path/spec.json
```

### 4. 校验

```bash
python skills/skill_creator/scripts/quick_validate.py \
  --root skills \
  --name demo_skill
```

## 实用建议

### 新增 skill 时

- 尽量先跑脚本生成骨架
- 再做局部编辑

### 更新现有 skill 时

- 先备份或看 diff
- 重新 materialize
- 最后人工补小差异

## 参考 CowAgent 的点

这里参考了 CowAgent `skill-creator` 的几个核心思路：

- 单独的 skill 目录
- `SKILL.md` 作为技能入口
- 用脚本做初始化和快速校验

但针对当前项目做了调整：

- 使用 snake_case 命名
- 强调 companion file 分离
- 增加 `materialize_skill.py`，减少 agent 手写文件的不稳定性
