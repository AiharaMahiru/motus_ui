# Frontend Integration Guide

## 1. Goal

This guide is for the WebUI, a future Tauri frontend, or any other client consuming the backend APIs.

The backend additions covered in this phase fall into three groups:

- session governance: guardrails, sandbox, MCP exposure policy, HITL / approval config
- model capability controls: provider, cache policy, declarative response formats
- runtime policy: memory configuration and workflow timeout / retry

These options should not all be pushed into the main composer. A better split is:

- common controls: `provider`, `model_name`, `thinking`, `max_steps`, `timeout_seconds`
- advanced controls: `cache_policy`, `sandbox`, `guardrails`, `MCP`, `multi_agent`, `response_format`, `memory`

## 2. Start with Capability Detection

Request this first when the frontend boots:

```http
GET /api/meta
```

Important fields:

- `backend_mode`
- `supports_interrupts`
- `supports_dynamic_session_config`
- `supports_preview`
- `supports_structured_response_format`

### Recommended UI Behavior

- `supports_interrupts=false`
  - hide or disable `human_in_the_loop`, `approval_tool_names`, and interrupt recovery UI
- `supports_dynamic_session_config=false`
  - turn the session config pane into read-only mode after session creation
- `supports_preview=false`
  - hide code preview, terminal preview, and canvas execution entrypoints
- `supports_structured_response_format=false`
  - hide structured output editors

## 3. New Session Fields

Session creation and update still use:

```http
POST /api/sessions
PATCH /api/sessions/{session_id}
GET /api/sessions/{session_id}
```

New fields in this phase:

### Base Model Layer

- `provider`: `openai | anthropic | gemini | openrouter`
- `cache_policy`: `none | static | auto | auto_1h`
- `response_format`

### Runtime Governance Layer

- `sandbox`
- `human_in_the_loop`
- `approval_tool_names`
- `input_guardrails`
- `output_guardrails`
- `tool_guardrails`
- `mcp_servers[].prefix`
- `mcp_servers[].allowlist`
- `mcp_servers[].blocklist`
- `mcp_servers[].method_aliases`
- `mcp_servers[].image`
- `mcp_servers[].sandbox`

### Memory Layer

- `memory.type`: `basic | compact`
- `memory.compact_model_name`
- `memory.safety_ratio`
- `memory.token_threshold`
- `memory.max_tool_result_tokens`
- `memory.tool_result_truncation_suffix`

## 4. New Workflow Fields

Continue using:

```http
POST /api/workflows/plans
POST /api/workflows/runs
POST /api/workflows/agent-runs
GET /api/workflows/runs/{run_id}
```

`WorkflowRunRequest` now includes:

- `runtime.timeout_seconds`
- `runtime.max_retries`
- `runtime.retry_delay_seconds`

`WorkflowRunSummary / Detail` now includes:

- `runtime`
- `attempt_count`

Recommended UI uses:

- display current runtime policy
- show retry count
- signal timeout-driven failure clearly

## 5. Recommended UI Mapping

### Session Creation Dialog

Recommended minimum fields:

- `title`
- `provider`
- `model_name`
- `thinking.enabled / effort / verbosity`
- `max_steps`
- `timeout_seconds`

Recommended advanced section:

- `cache_policy`
- `enabled_tools`
- `sandbox`
- `mcp_servers`
- `multi_agent`
- `human_in_the_loop`
- `approval_tool_names`
- `response_format`
- `memory`
- `input_guardrails / output_guardrails / tool_guardrails`

### Session Detail Page

Treat the following as the true active session config rather than a local draft:

- `provider`
- `model_name`
- `cache_policy`
- `thinking`
- `max_steps`
- `timeout_seconds`
- `enabled_tools`
- `sandbox`
- `mcp_servers`
- `multi_agent`
- `response_format`
- `memory`

## 6. Editing Guidance

### Sandbox

Recommended UI: radio or segmented cards for:

- `local`
- `docker`
- `cloud`

Show provider-specific fields dynamically:

- `local`: `cwd`
- `docker`: `image`, `mount_project_root`, `mount_path`
- `cloud`: `cloud_url`, `token_env_var`

### Guardrails

Recommended UI: rule list editor. Each rule should support at least:

- `kind`
- `message`
- `pattern`
- `replacement`
- `max_length`
- `ignore_case / multiline / dotall`

`tool_guardrails` should also support:

- `tool_name`
- `path_fields`
- `require_absolute_paths`
- `allowed_roots`

### Response Format

Recommended UI: structured field editor with:

- `name`
- `description`
- `fields[]`

Each field should include:

- `name`
- `type`
- `description`
- `required`

### Memory

Recommended UI: simple mode switch:

- `basic`
- `compact`

Only reveal advanced parameters when `compact` is selected.

## 7. Request Example

### Create a Session with Structured Output

```json
{
  "title": "Structured extract",
  "provider": "openai",
  "model_name": "gpt-4o",
  "response_format": {
    "name": "article_summary",
    "description": "Structured article summary",
    "fields": [
      {"name": "title", "type": "string", "required": true},
      {"name": "keywords", "type": "array[string]", "required": true},
      {"name": "confidence", "type": "number", "required": false}
    ]
  }
}
```

## 8. Integration Principle

Frontend work may redesign layout and interaction, but it should not invent a parallel protocol.

That means:

- trust shared schemas first
- trust `/api/meta` for capability gates
- trust `SessionDetail` as the canonical active session config
- avoid hardcoded assumptions about backend mode, preview, interrupt support, or structured output support
