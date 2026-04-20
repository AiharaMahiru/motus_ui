from __future__ import annotations

from pathlib import Path


# 统一维护项目级路径，避免目录整理后各模块继续各自拼路径。
PROJECT_ROOT = Path(__file__).resolve().parents[2]
APPS_DIR = PROJECT_ROOT / "apps"
DOCS_DIR = PROJECT_ROOT / "docs"
RUNTIME_DIR = PROJECT_ROOT / "runtime"
CONVERSATION_LOG_DIR = RUNTIME_DIR / "conversation_logs"
SESSIONS_DIR = RUNTIME_DIR / "sessions"
HITL_SESSIONS_DIR = RUNTIME_DIR / "hitl_sessions"
WORKFLOW_RUNS_DIR = RUNTIME_DIR / "workflow_runs"
TOOL_PLUGINS_DIR = RUNTIME_DIR / "tool_plugins"
WORKFLOW_PLUGINS_DIR = RUNTIME_DIR / "workflow_plugins"
OUTPUT_DIR = RUNTIME_DIR / "output"
UPLOADS_DIR = RUNTIME_DIR / "uploads"
TRACES_DIR = RUNTIME_DIR / "traces"
SESSION_TRACES_DIR = TRACES_DIR / "sessions"
WORKFLOW_TRACES_DIR = TRACES_DIR / "workflows"
SKILLS_DIR = PROJECT_ROOT / "skills"
TOOLS_DIR = PROJECT_ROOT / "tools"
