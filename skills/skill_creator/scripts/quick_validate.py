from __future__ import annotations

import argparse
import re
from pathlib import Path


FRONTMATTER_PATTERN = re.compile(
    r"^---\nname:\s*(?P<name>[a-z0-9_]+)\ndescription:\s*(?P<description>.+?)\n---\n",
    re.DOTALL,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="快速校验 skill 目录结构。")
    parser.add_argument("--root", default="skills", help="skills 根目录")
    parser.add_argument("--name", required=True, help="skill 名称")
    args = parser.parse_args()

    skill_dir = Path(args.root).resolve() / args.name
    if not skill_dir.exists():
        raise SystemExit(f"Skill directory does not exist: {skill_dir}")

    skill_md = skill_dir / "SKILL.md"
    reference_md = skill_dir / "reference.md"
    if not skill_md.exists():
        raise SystemExit("Missing SKILL.md")
    if not reference_md.exists():
        raise SystemExit("Missing reference.md")

    content = skill_md.read_text(encoding="utf-8")
    match = FRONTMATTER_PATTERN.match(content)
    if not match:
        raise SystemExit("SKILL.md frontmatter is invalid or missing")
    if match.group("name") != args.name:
        raise SystemExit("Frontmatter name does not match directory name")
    if "## 推荐流程" not in content:
        raise SystemExit("SKILL.md missing 推荐流程 section")
    if "## 关键约束" not in content:
        raise SystemExit("SKILL.md missing 关键约束 section")

    print(f"Skill {args.name} passed quick validation")


if __name__ == "__main__":
    main()
