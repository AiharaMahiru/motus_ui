# Contributing

Thank you for contributing to Motus Agent Workbench. Before opening a change, keep the scope clear, make the result testable, and avoid committing local runtime data.

## Development Setup

1. Copy `.env.example` to `.env` and keep real secrets local.
2. Install Python dependencies with `uv sync`.
3. Install WebUI dependencies with `cd web && npm install`.
4. Initialize third-party skills with `git submodule update --init --recursive` if you did not clone with `--recurse-submodules`.
5. Keep modules small and focused. Do not move business logic back into page-level React components or central API catch-all files.

## Recommended Checks

Run the checks that match your change:

```bash
uv run pytest
uv run python -m py_compile apps/*.py core/**/*.py tools/**/*.py scripts/**/*.py
cd web
npm run build
npm run test
```

For WebUI layout or interaction work, also run the affected Playwright smoke test or provide a manual screenshot.

## Code Style

- Python uses 4-space indentation, explicit type hints, and schema-first API boundaries.
- React code should stay under feature modules in `web/src/features/` when practical.
- Use `lucide-react` for icons by default.
- Add short comments only for non-obvious state machines, async flows, SDK adapters, cost accounting, or persistence logic.
- Remove obsolete compatibility code, temporary logs, and debug-only branches before submitting.

## Pull Requests

PRs should include:

- The problem being solved and the chosen approach.
- Affected modules, APIs, SSE events, environment variables, or data structures.
- Verification commands and results.
- Screenshots for WebUI changes, including relevant theme, language, and viewport coverage.
- Example requests or responses for backend, workflow, HITL, or preview changes.

## Security And Runtime Data

Do not commit `.env`, real API keys, session logs, uploads, preview outputs, trace artifacts, release archives, or generated smoke reports. Runtime artifacts should remain under `runtime/` and stay ignored by Git.

Before a public release, review [`docs/open-source-release-checklist.md`](docs/open-source-release-checklist.md).
