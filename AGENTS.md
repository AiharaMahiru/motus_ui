# Repository Guidelines

## Project Structure & Module Organization
This repository is a Python 3.14 Motus SDK project with a backend-first layout and a React WebUI. Entry modules live in `apps/`, core runtime code in `core/`, long-form docs in `docs/`, runtime skills in `skills/<skill_name>/`, implementation integrations in `tools/integrations/`, smoke helpers in `scripts/`, and frontend code in `web/src/`. Runtime artifacts are written under `runtime/` and must not be committed.

## Build, Test, and Development Commands
Use `uv` for all local work.

- `uv sync`: install dependencies from `pyproject.toml` and `uv.lock`.
- `uv run agent-server`: start the FastAPI service from `apps/server.py`.
- `uv run agent-tui`: launch the Textual terminal UI.
- `uv run agent-hitl-server`: start the dedicated HITL server.
- `uv run pytest`: run Python tests.
- `uv run python -m py_compile apps/*.py core/**/*.py tools/**/*.py`: quick syntax smoke check used in this repo.
- `cd web && npm run build`: type-check and build the WebUI.
- `cd web && npm run test`: run Vitest with coverage.

Set secrets in the root `.env`; do not hardcode API keys or MCP endpoints.

## Coding Style & Naming Conventions
Use 4-space indentation, explicit type hints, and small focused modules. Follow Python naming defaults: `snake_case` for files, functions, and variables, `PascalCase` for classes, and descriptive schema names such as `SessionCreateRequest`. Keep UI code dependent on `core.backends` and `core.schemas`, not `core.servers`. Write concise Simplified Chinese comments for non-obvious workflow, async, state-machine, SDK, or cost-accounting logic.

## Testing Guidelines
Python tests live under `tests/` and use `pytest` with `test_*.py` naming. Frontend component and hook tests live beside `web/src` modules and use Vitest. For logic-heavy changes, add tests near the affected layer and run the focused test first, then the relevant suite. At minimum, run the `py_compile` smoke check and manually verify the affected entrypoint: API, WebUI, HITL, preview, tracing, or workflow route.

## Commit & Pull Request Guidelines
The current workspace snapshot does not include `.git` history, so no local commit convention can be extracted. Use short imperative commits, preferably Conventional Commit style, for example `feat(workflow): add skill bootstrap flow`. PRs should include scope, affected modules, `.env` or API changes, and verification steps. Include screenshots for WebUI changes and example requests or responses for backend, HITL, preview, tracing, or workflow changes.

## Security & Release Hygiene
Never commit `.env`, provider keys, conversation logs, uploads, preview outputs, traces, packaged archives, `node_modules/`, `.venv/`, or coverage/build artifacts. Keep reusable examples in `.env.example` and sanitized docs only. Before a public release, follow `docs/open-source-release-checklist.md`.
