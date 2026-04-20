from __future__ import annotations

from pathlib import Path

from core.config.paths import DOCS_DIR
from core.runtime_catalog import render_runtime_requirements_markdown


OUTPUT_PATH = DOCS_DIR / "runtime-requirements.md"


def main() -> None:
    OUTPUT_PATH.write_text(render_runtime_requirements_markdown(), encoding="utf-8")
    print(f"已更新：{OUTPUT_PATH}")


if __name__ == "__main__":
    main()
