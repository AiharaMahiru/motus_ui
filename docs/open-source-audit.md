# Open Source Audit Record

Audit date: 2026-04-20

## Completed

- Root `.gitignore` now covers `.env`, `.env.*`, `runtime/`, `release/`, `.venv/`, `node_modules/`, `web/dist/`, `web/coverage/`, `web/test-results/`, `*.egg-info/`, `__pycache__/`, `*.pyc`, and local task scratch files.
- `.env.example` was added and contains variable names only, with no real secret values.
- The root `README.md` was rewritten into a public repository landing page.
- `CONTRIBUTING.md`, `SECURITY.md`, and `docs/open-source-release-checklist.md` were added.
- `pyproject.toml` metadata was normalized and the package name was set to `motus-agent-workbench`.
- The root repository license is explicitly aligned with `Apache-2.0` and reflected in both documentation and package metadata.

## Sensitive Information Scan

The scan excluded `vendor/`, `runtime/`, `release/`, `node_modules/`, `web/node_modules/`, and `.venv/`.

Findings:

- `.env` contains real `OPENAI_API_KEY` and `FIRECRAWL_KEY`, but `.gitignore` explicitly excludes it from version control.
- Source code and docs only contain placeholder examples such as `OPENAI_API_KEY=...`, `FIRECRAWL_KEY=...`, and a `test-key` fixture.
- `web/dist/` and generated `*.egg-info/` directories contain build leftovers and should not be published.

## Local Runtime Artifacts

The working directory still contains substantial local runtime data:

- `runtime/conversation_logs/`
- `runtime/sessions/`
- `runtime/hitl_sessions/`
- `runtime/workflow_runs/`
- `runtime/traces/`
- `runtime/uploads/`
- `runtime/output/`
- `runtime/smoke/`
- `runtime/ui-acceptance-20260420/`
- `release/agent-source-20260417-015448.zip`
- `web/dist/`
- `web/coverage/`
- `web/test-results/`
- `agent.egg-info/`
- `motus_agent_workbench.egg-info/`
- multiple `__pycache__/` folders and `*.pyc` files

These artifacts may include conversation content, debugging screenshots, trace metadata, uploaded files, or local build output and should remain private by default.

## Suggested Cleanup Not Yet Executed

The following commands will delete local caches, build output, and generated artifacts. Run them only after confirming those records are no longer needed.

```bash
find . -type d -name __pycache__ -prune -exec rm -rf {} +
find . -type f -name '*.pyc' -delete
rm -rf *.egg-info node_modules web/node_modules web/dist web/coverage web/test-results release
```

To remove all runtime state as well:

```bash
rm -rf runtime
```

Do not run `rm -rf runtime` unless you are sure user sessions, uploads, preview artifacts, screenshots, and smoke logs are no longer needed.

## Release-time Follow-ups

- Confirm that the `vendor/minimax-skills/` submodule initializes correctly for public clones and that its upstream licensing boundary is acceptable.
- Historical planning documents, one-off TODOs, matrices, and generated smoke result records were removed from `docs/` to keep public documentation stable and focused.
- Decide whether any screenshots should be made public. If so, sanitize them and move them into `docs/assets/`.

## Validation Results

Executed on 2026-04-20:

- `uv run python -m py_compile apps/*.py core/**/*.py tools/**/*.py scripts/**/*.py`: passed
- `uv run pytest`: passed, 70 tests passed, 1 third-party `google.genai` deprecation warning
- `cd web && npm run build`: passed, with existing Vite large-chunk warnings
- `cd web && npm run test`: passed, 25 test files / 64 tests passed; jsdom reported `HTMLCanvasElement.getContext()` limitations but exit status was still successful

This audit pass also added `pytest` as a development dependency and updated `uv.lock` so the documented test commands work directly.
