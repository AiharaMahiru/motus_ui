from __future__ import annotations

import argparse
import re
from pathlib import Path


SKILL_MD_TEMPLATE = """---
name: {name}
description: TODO: replace with a clear one-line description.
---

# {name}

当用户需要：

- TODO

优先加载这个 skill。

## 推荐流程

1. TODO

## 关键约束

- TODO

## 参考资料

详细内容见同目录的 `reference.md`
"""


REFERENCE_MD_TEMPLATE = """# {name} reference

## Overview

TODO
"""


def validate_skill_name(name: str) -> None:
    if not re.fullmatch(r"[a-z][a-z0-9_]*", name):
        raise ValueError("skill 名称必须是小写 snake_case，且以字母开头。")


def main() -> None:
    parser = argparse.ArgumentParser(description="初始化一个项目内 skill 目录。")
    parser.add_argument("--root", default="skills", help="skills 根目录")
    parser.add_argument("--name", required=True, help="skill 名称，小写 snake_case")
    parser.add_argument("--with-scripts", action="store_true", help="额外创建 scripts/ 目录")
    args = parser.parse_args()

    validate_skill_name(args.name)

    root = Path(args.root).resolve()
    skill_dir = root / args.name
    skill_dir.mkdir(parents=True, exist_ok=True)

    skill_md = skill_dir / "SKILL.md"
    reference_md = skill_dir / "reference.md"

    if not skill_md.exists():
        skill_md.write_text(SKILL_MD_TEMPLATE.format(name=args.name), encoding="utf-8")
    if not reference_md.exists():
        reference_md.write_text(REFERENCE_MD_TEMPLATE.format(name=args.name), encoding="utf-8")

    if args.with_scripts:
        (skill_dir / "scripts").mkdir(exist_ok=True)

    print(f"Initialized skill at {skill_dir}")


if __name__ == "__main__":
    main()
