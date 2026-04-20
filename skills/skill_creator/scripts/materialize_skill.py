from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def validate_skill_name(name: str) -> None:
    if not re.fullmatch(r"[a-z][a-z0-9_]*", name):
        raise ValueError("skill 名称必须是小写 snake_case，且以字母开头。")


def bullet_lines(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items) if items else "- TODO"


def numbered_lines(items: list[str]) -> str:
    return "\n".join(f"{index}. {item}" for index, item in enumerate(items, start=1)) if items else "1. TODO"


def render_skill_md(spec: dict) -> str:
    return (
        "---\n"
        f"name: {spec['name']}\n"
        f"description: {spec['description']}\n"
        "---\n\n"
        f"# {spec['name']}\n\n"
        "当用户需要：\n\n"
        f"{bullet_lines(spec.get('use_cases', []))}\n\n"
        "优先加载这个 skill。\n\n"
        "## 推荐流程\n\n"
        f"{numbered_lines(spec.get('flow', []))}\n\n"
        "## 关键约束\n\n"
        f"{bullet_lines(spec.get('constraints', []))}\n\n"
        "## 参考资料\n\n"
        "详细内容见同目录的 `reference.md`\n"
    )


def render_reference_md(spec: dict) -> str:
    sections = spec.get("reference_sections", {})
    if not sections:
        sections = {"Overview": ["TODO"]}

    lines = [f"# {spec['name']} reference", "", "## Suggested Tools", "", bullet_lines(spec.get("tools", [])), ""]
    for title, items in sections.items():
        lines.append(f"## {title}")
        lines.append("")
        lines.append(bullet_lines(items))
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="根据 spec 渲染 skill 文件。")
    parser.add_argument("--root", default="skills", help="skills 根目录")
    parser.add_argument("--name", required=True, help="skill 名称")
    parser.add_argument("--spec", required=True, help="spec.json 路径")
    args = parser.parse_args()

    validate_skill_name(args.name)

    spec_path = Path(args.spec).resolve()
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    if spec.get("name") != args.name:
        raise ValueError("spec.name 必须与 --name 一致。")

    skill_dir = Path(args.root).resolve() / args.name
    skill_dir.mkdir(parents=True, exist_ok=True)

    (skill_dir / "SKILL.md").write_text(render_skill_md(spec), encoding="utf-8")
    (skill_dir / "reference.md").write_text(render_reference_md(spec), encoding="utf-8")

    print(f"Materialized skill at {skill_dir}")


if __name__ == "__main__":
    main()
