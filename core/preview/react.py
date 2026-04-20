from __future__ import annotations

import textwrap
from pathlib import Path

from core.config.paths import PROJECT_ROOT

WEB_ROOT = PROJECT_ROOT / "web"
WEB_NODE_MODULES = WEB_ROOT / "node_modules"
VITE_BIN = WEB_NODE_MODULES / "vite" / "bin" / "vite.js"
VITE_PLUGIN_REACT = WEB_NODE_MODULES / "@vitejs" / "plugin-react" / "dist" / "index.js"


def ensure_default_export(code: str) -> str:
    if "export default" in code:
        return code
    return (
        "function PreviewComponent() {\n"
        f"{textwrap.indent(code.rstrip(), '  ')}\n"
        "}\n\n"
        "export default PreviewComponent\n"
    )


def react_entry_mode(code: str) -> str:
    if "createRoot(" in code or "ReactDOM.render(" in code:
        return "self-mounted"
    return "component"


def build_react_main_source(code: str) -> str:
    if react_entry_mode(code) == "self-mounted":
        return code
    return textwrap.dedent(
        """
        import React from 'react'
        import { createRoot } from 'react-dom/client'
        import UserPreview from './UserPreview'

        const container = document.getElementById('root')
        const root = createRoot(container)
        root.render(<UserPreview />)
        """
    ).strip()


def vite_config_source() -> str:
    return textwrap.dedent(
        f"""
        import {{ defineConfig }} from 'vite'
        import react from '{VITE_PLUGIN_REACT.as_posix()}'

        export default defineConfig({{
          plugins: [react()],
          build: {{
            outDir: 'dist',
            emptyOutDir: true,
          }},
        }})
        """
    ).strip()


def react_index_html() -> str:
    return textwrap.dedent(
        """
        <!doctype html>
        <html lang="zh-CN">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Agent Preview</title>
          </head>
          <body>
            <div id="root"></div>
            <script type="module" src="/src/main.tsx"></script>
          </body>
        </html>
        """
    ).strip()
