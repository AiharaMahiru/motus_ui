from pathlib import Path
import json

from motus.memory import BasicMemory, CompactionMemory, CompactionMemoryConfig
from motus.models import ChatMessage

from core.config.env import load_project_env
from core.config.paths import CONVERSATION_LOG_DIR, PROJECT_ROOT
from core.schemas.memory import MemoryConfig


load_project_env()


def resolve_memory_log_dir(log_dir: str | None = None) -> str:
    """解析 memory 日志目录，并兼容旧的根目录布局。

    当前推荐目录是 `runtime/conversation_logs/`。如果调用方没有显式传入路径，
    且新目录还不存在但旧的 `conversation_logs/` 目录存在，则优先复用旧目录，
    避免项目整理后丢失历史会话恢复能力。
    """

    if log_dir:
        return log_dir

    legacy_dir = PROJECT_ROOT / "conversation_logs"
    if not CONVERSATION_LOG_DIR.exists() and legacy_dir.exists():
        return str(legacy_dir)
    return str(CONVERSATION_LOG_DIR)


def _load_messages_from_log(session_id: str, log_dir: str) -> list[ChatMessage]:
    """从 JSONL 会话日志恢复消息列表。"""

    log_path = Path(log_dir) / f"{session_id}.jsonl"
    if not log_path.exists():
        return []

    messages: list[ChatMessage] = []
    try:
        with log_path.open(encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line:
                    continue
                entry = json.loads(line)
                if entry.get("type") != "message":
                    continue
                raw_message = entry.get("message")
                if not isinstance(raw_message, dict):
                    continue
                messages.append(ChatMessage.model_validate(raw_message))
    except Exception:
        return []
    return messages


def _setup_basic_memory(
    *,
    session_id: str,
    resolved_log_dir: str,
    settings: MemoryConfig,
) -> BasicMemory:
    memory = BasicMemory(
        max_tool_result_tokens=settings.max_tool_result_tokens,
        tool_result_truncation_suffix=settings.tool_result_truncation_suffix,
    )
    memory._messages = _load_messages_from_log(session_id, resolved_log_dir)
    return memory


def _setup_compaction_memory(
    *,
    session_id: str,
    resolved_log_dir: str,
    settings: MemoryConfig,
) -> CompactionMemory:
    compact_model_name = settings.compact_model_name or "gpt-5.4 mini"
    token_threshold = settings.token_threshold or 256000

    try:
        memory = CompactionMemory.restore_from_log(
            session_id=session_id,
            log_base_path=resolved_log_dir,
        )
        # restore_from_log 只恢复消息和部分 config，这里补齐当前项目约束。
        memory.config.compact_model_name = compact_model_name
        memory.config.safety_ratio = settings.safety_ratio
        memory.config.token_threshold = token_threshold
        memory.config.max_tool_result_tokens = settings.max_tool_result_tokens
        memory.config.tool_result_truncation_suffix = settings.tool_result_truncation_suffix
        memory.on_compact = lambda stats: print(f"Compacted {stats['messages_compacted']} messages")
        return memory
    except ValueError:
        return CompactionMemory(
            config=CompactionMemoryConfig(
                compact_model_name=compact_model_name,
                safety_ratio=settings.safety_ratio,
                token_threshold=token_threshold,
                max_tool_result_tokens=settings.max_tool_result_tokens,
                tool_result_truncation_suffix=settings.tool_result_truncation_suffix,
                session_id=session_id,
                log_base_path=resolved_log_dir,
            ),
            on_compact=lambda stats: print(f"Compacted {stats['messages_compacted']} messages"),
        )


def setup_memory(
    session_id: str = "motus-session",
    *,
    settings: MemoryConfig | None = None,
    log_dir: str | None = None,
):
    """按配置构造 memory，并尽量从日志恢复历史。"""

    resolved_settings = settings or MemoryConfig()
    resolved_log_dir = resolve_memory_log_dir(log_dir)
    Path(resolved_log_dir).mkdir(parents=True, exist_ok=True)

    if resolved_settings.type == "basic":
        return _setup_basic_memory(
            session_id=session_id,
            resolved_log_dir=resolved_log_dir,
            settings=resolved_settings,
        )

    return _setup_compaction_memory(
        session_id=session_id,
        resolved_log_dir=resolved_log_dir,
        settings=resolved_settings,
    )
