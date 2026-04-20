# Project Structure

The goal of this reorganization was not a full rewrite. The goal was to separate stable entrypoints from implementation-heavy directories so the project can keep growing without collapsing into a flat, hard-to-maintain tree.

## Recommended Mental Model

```text
apps/                  Entrypoints
core/chat/             Sessions, titles, message storage, tool summaries
core/preview/          HTML / React / Python preview runtime
core/visualization/    Data analysis, chart policy, visualization rewriting
core/workflows/        Workflow registry, planning, execution
core/services/         Thin facade layer only
core/servers/          FastAPI / HITL service surface
core/backends/         UI-facing backend abstraction layer
core/schemas/          Shared backend/frontend schemas
web/                   WebUI
scripts/smoke/         System smoke scripts
skills/                Project runtime skills
runtime/               Sessions, traces, previews, uploads, and other artifacts
```

## Reorganization Principles

1. `core/services/` should no longer carry large implementation modules. It should remain a stable export and facade layer.
2. Chat, preview, visualization, and workflow logic should live in dedicated packages instead of continuing to grow through flat cross-imports.
3. External APIs, session schemas, and SSE event contracts should remain stable so the frontend and smoke scripts do not break.
4. Generated artifacts must stay separate from source code, and version control must ignore `runtime/`, `web/dist/`, `web/node_modules/`, and similar directories.

## Follow-up Recommendations

1. `core/ui/tui_app.py` is still large. If TUI is fully deprecated in the future, archive it or split it into smaller view modules.
2. `web/src/features/chat/pages/ChatPage.tsx` is still too large and should be split further into state management, preview coordination, and timeline rendering.
3. `README.md` should remain a repository landing page. Deeper design notes should stay in `docs/`.

## Verification

The following checks were executed successfully during this restructuring phase:

1. `uv run python -m py_compile $(find apps core scripts tests -type f -name '*.py' -not -path '*/__pycache__/*')`
2. `uv run python -m unittest discover -s tests -p 'test_*.py'`
3. `uv run python -m scripts.smoke.workflow_tracing`
4. `uv run python -m scripts.smoke.local_backend`
