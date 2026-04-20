# Tools Directory

This directory contains all implementation-side tools available to the Motus agent. Subdirectories are grouped by responsibility so the root stays clean.

## Navigation

- **[integrations](./integrations/)**: External tool integrations and implementation-side reference material such as Firecrawl and Office CLI.
- **[mcps](./mcps/)**: Contains Model Context Protocol (MCP) clients and definitions.

## Important Distinction

This `tools/integrations/` subtree is implementation-side code and reference material, not the runtime skill-loading root.

Runtime skill loading uses the project-root [`skills/`](../skills/) directory instead.

Use the split this way:

- `skills/`
  Runtime-facing skill prompts loaded via `load_skill`
- `tools/integrations/`
  Implementation code and internal reference material for tool authors

## How to use Context-Efficient Documentation

When you need to know how to use a specific tool module, navigate to its respective folder and read its specific `README.md`. This saves token usage by lazy-loading documentation instead of crowding the main system prompt.
