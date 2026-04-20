# Open Source Release Checklist

This checklist is used to prepare the repository for public release. By default, runtime data, secrets, build output, and local caches must stay out of version control.

## Required Checks

- The root repository license must remain `Apache-2.0` and stay consistent across `README.md`, package metadata, and release docs.
- `.env` stays local only. The public repository should expose `.env.example` only.
- `runtime/`, `release/`, `web/dist/`, `web/coverage/`, and `web/test-results/` must not be committed.
- `node_modules/`, `web/node_modules/`, `.venv/`, `*.egg-info/`, and `__pycache__/` must not be committed.
- Conversation logs, screenshots, preview outputs, and real-provider validation artifacts are runtime data and should not be public by default.
- If screenshots or smoke artifacts need to be published, they must be sanitized first and moved into `docs/assets/` or another dedicated example directory.
- `vendor/minimax-skills/` is a third-party submodule. Verify that the submodule URL, upstream availability, and license notes are correct before release.

## Recommended to Keep

- `apps/`, `core/`, `scripts/`, `skills/`, `tools/`, `web/src/`
- `tests/` with unit and smoke entrypoints
- `docs/` covering contributor guidance, architecture notes, frontend integration, open-source hygiene, and runtime requirements
- `uv.lock` and `web/package-lock.json` for reproducible dependency resolution

## Pre-release Validation

```bash
uv sync
uv run pytest
uv run python -m py_compile apps/*.py core/**/*.py tools/**/*.py scripts/**/*.py
cd web
npm install
npm run build
npm run test
```

## Optional Cleanup Commands

The following commands delete local caches, build output, and generated artifacts. Only run them if those local records are no longer needed.

```bash
find . -type d -name __pycache__ -prune -exec rm -rf {} +
find . -type f -name '*.pyc' -delete
rm -rf agent.egg-info node_modules web/node_modules web/dist web/coverage web/test-results
```

Do not delete `runtime/` by default. It may contain user sessions, uploaded files, preview artifacts, and debugging screenshots.
