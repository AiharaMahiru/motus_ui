# Development Guide

## Project Goals

This project uses the Motus SDK to build an extensible agent service. The main capability areas currently include:

- Multi-turn session management
- Tool execution
- Thinking configuration
- Usage and cost accounting
- SSE-based intermediate status streaming

This document defines the development conventions that keep the codebase readable, maintainable, and stable over time.

## Directory Overview

- `apps/`
  Entrypoints:
  - `apps/server.py`: HTTP server startup
  - `apps/tui.py`: TUI startup
  - `apps/hitl.py`: HITL server startup
- `core/`
  Core runtime logic, split by responsibility:
  - `core/config/`: environment and base configuration
  - `core/llm/`: model clients and cost calculation
  - `core/memory/`: memory initialization and recovery
  - `core/agents/`: agent construction and HITL agent wiring
  - `core/schemas/`: shared session and request/response models
  - `core/services/`: local service facades
- `core/backends/`: unified backend protocol and adapters
- `core/servers/`: HTTP server and HITL server
- `core/ui/`: TUI implementation
- `core/workflows/`: workflow registry and implementation
- `tools/`: tool definitions and integration-side code
- `web/`
  Web workbench frontend:
  - `src/app/`: app shell, router, providers
  - `src/features/`: chat, sessions, workflow, tracing, runtime, meta
  - `src/shared/`: shared API contracts, SSE parsing, formatting utilities
  - `tests/e2e/`: Playwright end-to-end coverage
- `docs/`: development and reference documentation
- `runtime/conversation_logs/`: session logs
- `runtime/output/`: generated runtime outputs
- `skills/`: project-local runtime skills using the recommended short `SKILL.md` + companion-file structure

## Environment Variable Rules

All environment variables are loaded from the project root `.env`. Sensitive values must never be hardcoded in source files.

Main variables in use today:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `FIRECRAWL_KEY`
- `APP_HOST`
- `APP_PORT`
- `OFFICECLI_BIN`

When adding a new configuration value:

- Prefer the root `.env`
- Use explicit, self-describing names
- Document the variable in `README.md` or this guide

## Startup Commands

Backend:

```bash
uv run python -m apps.server
```

WebUI development:

```bash
cd web
npm install
npm run dev
```

WebUI verification:

```bash
cd web
npm run build
npm run test
npm run e2e
```

If new tests, formatting, or validation commands are introduced, update this document as part of the same change.

## Development Principles

### 1. Readability First

Code should not only run. It should also be easy for the next maintainer to understand quickly.

Requirements:

- Accurate naming with minimal unnecessary abbreviations
- Single-purpose functions
- Clear module boundaries
- Minimal hidden behavior

### 2. Define Boundaries Before Implementation

Before adding a feature, define:

- inputs and outputs
- state ownership
- error handling behavior
- compatibility impact on existing interfaces

Do not dump new logic directly into entrypoint files or one oversized function.

### 3. Separate Configuration from Runtime Logic

The following should not be scattered across product logic:

- environment variable names
- default model parameters
- pricing maps
- service ports
- tool toggles

Keep these values centralized in configuration or helper modules under `core/`.

### 4. Keep UI Decoupled from Server Internals

When adding new UI surfaces in the future:

- UI should depend on `core.backends` for backend access
- UI should depend on `core.schemas` for shared models
- UI must not couple directly to internal `core/servers/` implementation

This keeps TUI, WebUI, desktop, and mobile clients able to share the same backend capabilities.

### 5. Skill Organization Rules

Project-local skills should follow:

- path pattern: `skills/<skill_name>/`
- entry file: `SKILL.md`
- detailed references: companion files such as `reference.md`

Requirements:

- Keep `SKILL.md` short and focused on triggers, recommended flow, and key constraints
- Move long examples and detailed parameters into companion files
- Load skills on demand through `load_skill` instead of stuffing long skill bodies into a system prompt

### 6. MCP Integration Rules

All MCP integration should flow through shared backend interfaces. UI should not invent its own MCP connection logic.

Constraints:

- MCP config models live under `core/schemas/`
- MCP session construction lives under `core/agents/`
- UI passes MCP config through `SessionCreateRequest.mcp_servers`
- server code handles transport only, not MCP business logic

Supported transports today:

- `remote_http`
- `local_stdio`

### 7. Workflow Integration Rules

Workflow logic must not be trapped in a specific UI or temporary endpoint.

Requirements:

- workflow input/output models live in `core/schemas/workflow.py`
- workflow runtime state lives in `core/workflows/service.py`
- workflow definitions are registered under `core/workflows/`
- API routers expose transport only and must not absorb workflow business logic

Current additional constraints:

- workflow run states must cover at least `queued / running / completed / cancelled / terminated / error`
- workflow control must go through `WorkflowService.cancel_run()` and `WorkflowService.terminate_run()`
- external workflows are loaded from `runtime/workflow_plugins/*.py` or `APP_WORKFLOW_MODULES`
- the workflow catalog is exposed through `/api/runtime/workflow-catalog`

### 8. Multi-Agent Integration Rules

Multi-agent capabilities must go through shared schemas and the agent factory. No UI should assemble supervisor/specialist trees by itself.

Requirements:

- multi-agent config models live in `core/schemas/multi_agent.py`
- supervisor and specialist tree construction lives in `core/agents/`
- the session layer consumes normalized config only
- streaming events such as `assistant.step` must carry `agent_name`
- usage and cost must include both supervisor and specialists
- child-agent output reduction should be declared through `output_extractor`

Current boundary:

- local sessions and the HTTP API already support dynamic multi-agent configuration
