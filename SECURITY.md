# Security Policy

## Supported Versions

This project is pre-1.0. Security fixes are handled on the current main development line.

## Reporting a Vulnerability

Please do not publish exploit details in public issues. Report suspected vulnerabilities privately to the project maintainer, including:

- affected version or commit,
- reproduction steps,
- expected and actual behavior,
- whether secrets, local files, tools, MCP servers, or preview sandboxes are involved.

## Sensitive Data

The application can store local conversations, uploaded files, preview artifacts, traces, and provider telemetry under `runtime/`. These files may contain private prompts, tool output, file paths, code, or provider metadata and must be treated as sensitive.

Never commit:

- `.env` or provider API keys,
- `runtime/` data,
- generated archives in `release/`,
- uploaded files or preview outputs,
- trace exports containing request or response metadata.

Use `.env.example` for documented configuration keys.
