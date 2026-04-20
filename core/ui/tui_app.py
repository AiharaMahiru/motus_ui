from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from itertools import cycle
from pathlib import Path
from typing import Any, Literal

from rich.markdown import Markdown
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from textual import on
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical, VerticalScroll
from textual.message import Message
from textual.widgets import (
    Button,
    Checkbox,
    Footer,
    Header,
    Input,
    Label,
    ListItem,
    ListView,
    Pretty,
    Select,
    Static,
    TabPane,
    TabbedContent,
    TextArea,
)

from core.agents.factory import ALL_TOOL_NAMES, BUSINESS_TOOL_NAMES, SKILL_TOOL_NAMES, SYSTEM_TOOL_NAMES, TOOL_LABELS
from core.config.paths import DOCS_DIR
from core.runtime_catalog import collect_runtime_checks, collect_skill_runtime_checks, runtime_checks_for_enabled_tools
from core.schemas.session import SessionCreateRequest, SessionDetail, SessionSummary, TurnMetrics
from core.chat import ChatService
from motus.models import ChatMessage


TOOL_CHECKBOX_IDS = {
    "web_search": "tool-web-search",
    "web_scrape": "tool-web-scrape",
    "web_interact": "tool-web-interact",
    "office_cli": "tool-office-cli",
    "bash": "tool-bash",
    "read_file": "tool-read-file",
    "write_file": "tool-write-file",
    "edit_file": "tool-edit-file",
    "glob_search": "tool-glob-search",
    "grep_search": "tool-grep-search",
    "to_do": "tool-to-do",
    "load_skill": "tool-load-skill",
}

RUNTIME_DOC_PATH = DOCS_DIR / "runtime-requirements.md"


def truncate_text(text: str, max_length: int = 64) -> str:
    """压缩文本，避免侧栏和状态标题过长。"""

    normalized = " ".join(text.split())
    if len(normalized) <= max_length:
        return normalized
    return f"{normalized[: max_length - 1]}…"


def summarize_step_event(event_name: str, payload: dict[str, Any]) -> str:
    """把步骤事件转成适合会话流展示的一句自然语言摘要。"""

    if event_name == "session.started":
        return f"开始处理：{truncate_text(payload.get('content', '新任务'))}"
    if event_name == "assistant.step":
        content = truncate_text(payload.get("content") or "模型继续分析")
        tool_calls = payload.get("tool_calls") or []
        if tool_calls:
            tool_names = ", ".join(call.get("name", "tool") for call in tool_calls[:3])
            return f"{content} · 调用 {tool_names}"
        return content
    if event_name == "session.error":
        return f"处理失败：{truncate_text(payload.get('message', '未知错误'))}"
    if event_name == "done":
        return "本轮结束"
    return truncate_text(str(payload))

def default_step_status(event_name: str) -> Literal["info", "running", "completed", "error"]:
    """为步骤事件推导初始状态。"""

    if event_name == "assistant.step":
        return "running"
    if event_name == "session.error":
        return "error"
    if event_name == "done":
        return "completed"
    return "info"


def step_badge_label(status: str) -> str:
    labels = {
        "info": "开始",
        "running": "运行",
        "completed": "完成",
        "error": "失败",
    }
    return labels.get(status, status)


def build_step_headline(entry: "StepEventEntry") -> str:
    """生成系统事件条的一行摘要。"""

    parts: list[str] = []
    agent_name = entry.payload.get("agent_name")
    if agent_name:
        parts.append(f"[{agent_name}]")
    parts.append(entry.summary)
    return truncate_text(" ".join(parts), 64)


def step_status_symbol(status: str, spinner_frame: str | None = None) -> str:
    symbols = {
        "info": "•",
        "completed": "✓",
        "error": "!",
    }
    if status == "running":
        return spinner_frame or "·"
    return symbols.get(status, "•")


def status_emoji(status: str) -> str:
    return {
        "ready": "OK",
        "missing": "NO",
        "manual": "MANUAL",
    }.get(status, status.upper())


@dataclass
class StepEventEntry:
    """会话流中的一步状态。

    这里保留原始 payload，是为了让用户在终端中展开后能看到完整详情，
    而不仅仅是表面那句摘要。
    """

    timestamp: str
    event_name: str
    summary: str
    status: Literal["info", "running", "completed", "error"] = "info"
    expanded: bool = False
    payload: dict[str, Any] = field(default_factory=dict)


@dataclass
class ConversationEntry:
    """统一的会话流条目。

    这个结构把“聊天消息”和“步骤状态”统一放在同一条流里，
    这样用户在终端里看到的就是完整时序，而不是聊天和步骤割裂成两块。
    """

    kind: Literal["message", "step"]
    message: ChatMessage | None = None
    step: StepEventEntry | None = None

    @classmethod
    def from_message(cls, message: ChatMessage) -> "ConversationEntry":
        return cls(kind="message", message=message)

    @classmethod
    def from_step(cls, step: StepEventEntry) -> "ConversationEntry":
        return cls(kind="step", step=step)


@dataclass
class SessionViewState:
    """TUI 侧维护的展示态。"""

    detail: SessionDetail
    title: str
    entries: list[ConversationEntry] = field(default_factory=list)
    last_metrics: TurnMetrics | None = None


class TurnEvent(Message):
    """后台 worker 推送的中间事件。"""

    def __init__(self, session_id: str, event_name: str, payload: dict[str, Any]) -> None:
        self.session_id = session_id
        self.event_name = event_name
        self.payload = payload
        super().__init__()


class TurnFinished(Message):
    """一轮对话完成后的 detail 快照。"""

    def __init__(self, session_id: str, detail: SessionDetail) -> None:
        self.session_id = session_id
        self.detail = detail
        super().__init__()


class TurnFailed(Message):
    """后台对话失败通知。"""

    def __init__(self, session_id: str, error_text: str) -> None:
        self.session_id = session_id
        self.error_text = error_text
        super().__init__()


class MessageBubble(Static):
    """单条消息气泡。

    用户消息和助手消息都用气泡展示，但不直接在这里做左右布局，
    左右布局交给外层 row 去控制，这样样式和逻辑都更清楚。
    """

    def __init__(self, message: ChatMessage) -> None:
        classes = "message-bubble"
        if message.role == "user":
            classes += " user-bubble"
        elif message.role == "assistant":
            classes += " assistant-bubble"
        else:
            classes += " tool-bubble"
        super().__init__(self._build_renderable(message), classes=classes)

    def _build_renderable(self, message: ChatMessage):
        if message.role == "user":
            body = Text(message.content or "", style="#e2e8f0")
            return Panel(
                body,
                title="你",
                title_align="left",
                border_style="#38bdf8",
                padding=(0, 1),
                expand=False,
            )
        if message.role == "assistant":
            content = message.content or ""
            renderable = Markdown(content) if content.strip() else Text("（空响应）", style="#94a3b8")
            return Panel(
                renderable,
                title="助手",
                title_align="left",
                border_style="#34d399",
                padding=(0, 1),
                expand=False,
            )
        return Panel(
            Text(message.content or "", style="#f8fafc"),
            title=f"工具 {message.name or 'unknown'}",
            title_align="left",
            border_style="#f59e0b",
            padding=(0, 1),
            expand=False,
        )


class MessageRow(Horizontal):
    """聊天区中的一行消息，用左右布局把角色区分开。"""

    def __init__(self, message: ChatMessage) -> None:
        self.message = message
        row_class = "message-row"
        if message.role == "user":
            row_class += " user-row"
        elif message.role == "assistant":
            row_class += " assistant-row"
        else:
            row_class += " tool-row"
        super().__init__(classes=row_class)

    def compose(self) -> ComposeResult:
        bubble = MessageBubble(self.message)
        if self.message.role == "user":
            yield Static("", classes="message-spacer")
            yield bubble
            return
        if self.message.role == "assistant":
            yield bubble
            yield Static("", classes="message-spacer")
            return
        yield Static("", classes="message-spacer")
        yield bubble
        yield Static("", classes="message-spacer")

    def on_mount(self) -> None:
        self.call_after_refresh(self._sync_height)

    def on_resize(self) -> None:
        self.call_after_refresh(self._sync_height)

    def _sync_height(self) -> None:
        """让行高跟随气泡真实高度，避免多条消息相互覆盖。"""

        bubble = self.query_one(MessageBubble)
        bubble_height = max(3, bubble.virtual_size.height)
        self.styles.height = bubble_height


class StepCard(Vertical):
    """会话流中的系统事件条。

    这里刻意做成紧凑的“单行系统消息条”，避免复杂嵌套布局把高度算坏。
    默认只展示一行摘要；展开后再挂载详情。
    """

    SPINNER_FRAMES = ("⠁", "⠂", "⠄", "⠂")

    def __init__(self, entry: StepEventEntry) -> None:
        self.entry = entry
        self._frame_iter = cycle(self.SPINNER_FRAMES)
        self._spinner_frame = next(self._frame_iter)
        super().__init__(classes=f"step-card step-{entry.status}")

    def compose(self) -> ComposeResult:
        yield Button(
            self._build_summary_line(),
            id="step-toggle",
            classes=f"step-summary step-{self.entry.status}",
            variant="default",
            flat=True,
        )
        yield Vertical(id="step-details-host", classes="step-details-host")

    def on_mount(self) -> None:
        self._sync_expand_state()
        if self.entry.status == "running":
            self.set_interval(0.18, self._advance_frame)

    @on(Button.Pressed, "#step-toggle")
    def handle_toggle(self) -> None:
        self.entry.expanded = not self.entry.expanded
        self._sync_expand_state()

    def _build_summary_line(self) -> str:
        symbol = step_status_symbol(self.entry.status, self._spinner_frame)
        badge = step_badge_label(self.entry.status)
        arrow = "▾" if self.entry.expanded else "▸"
        return f"{symbol} {badge}  {build_step_headline(self.entry)}  {self.entry.timestamp}  {arrow}"

    def _advance_frame(self) -> None:
        self._spinner_frame = next(self._frame_iter)
        self.query_one("#step-toggle", Button).label = self._build_summary_line()

    def _sync_expand_state(self) -> None:
        host = self.query_one("#step-details-host", Vertical)
        host.remove_children()
        if self.entry.expanded:
            details = self._build_details()
            host.mount(details)
        self.query_one("#step-toggle", Button).label = self._build_summary_line()

    def _build_details(self) -> Vertical:
        """仅在展开时创建详情节点，避免折叠态占额外高度。"""

        payload = self.entry.payload
        details = Table.grid(padding=(0, 1))
        details.add_column(style="bold #94a3b8")
        details.add_column(style="#e2e8f0")
        details.add_row("时间", self.entry.timestamp)
        details.add_row("类型", self.entry.event_name)
        if payload.get("agent_name"):
            details.add_row("Agent", str(payload["agent_name"]))
        if payload.get("tool_calls"):
            tool_names = ", ".join(call.get("name", "tool") for call in payload["tool_calls"])
            details.add_row("工具", tool_names)
        if payload.get("content"):
            details.add_row("说明", truncate_text(str(payload["content"]), 220))
        if payload.get("message"):
            details.add_row("消息", truncate_text(str(payload["message"]), 220))

        container = Vertical(classes="step-details")
        container.mount(
            Static(
                Panel(
                    details,
                    border_style="#334155",
                    title="步骤详情",
                    title_align="left",
                    padding=(0, 1),
                    expand=False,
                ),
                classes="step-details-summary",
            )
        )
        container.mount(Pretty(payload))
        return container

class StepRow(Vertical):
    """会话流中的步骤状态行。"""

    def __init__(self, entry: StepEventEntry) -> None:
        self.entry = entry
        super().__init__(classes="step-row")

    def compose(self) -> ComposeResult:
        yield StepCard(self.entry)


class MotusTUIApp(App[None]):
    """本地终端界面。

    这版布局的重点是：
    1. 聊天内容改成左右对话流，更接近真实聊天体验；
    2. 步骤状态嵌入同一条会话流，避免用户在两个区域来回跳；
    3. 右侧只保留“指标”和“新会话配置”，承担辅助信息而非主叙事。
    """

    CSS_PATH = Path(__file__).resolve().with_name("tui.tcss")
    TITLE = "Motus Agent TUI"
    SUB_TITLE = "终端优先 · 会话流 · 状态嵌入 · 成本洞察"

    BINDINGS = [
        Binding("n", "new_session", "新会话"),
        Binding("ctrl+s", "send_message", "发送"),
        Binding("/", "focus_search", "搜索会话"),
        Binding("i", "focus_composer", "聚焦输入"),
        Binding("s", "focus_sessions", "聚焦列表"),
        Binding("x", "delete_session", "删除会话"),
        Binding("ctrl+l", "clear_active_logs", "清理界面"),
        Binding("q", "quit", "退出"),
    ]

    def __init__(self, chat_service: ChatService | None = None) -> None:
        super().__init__()
        self.chat_service = chat_service or ChatService()
        self.sessions: dict[str, SessionViewState] = {}
        self.session_order: list[str] = []
        self.visible_session_ids: list[str] = []
        self.active_session_id: str | None = None
        self.session_counter = 0
        self.session_filter_text = ""

    def _suggest_next_title(self) -> str:
        return f"会话 {max(1, len(self.session_order) + 1):02d}"

    def _display_title(self, detail: SessionDetail, fallback_index: int | None = None) -> str:
        if detail.title:
            return detail.title
        if fallback_index is not None:
            return f"会话 {fallback_index:02d}"
        return f"会话 {max(1, len(self.session_order)):02d}"

    def _build_session_state(self, detail: SessionDetail, *, fallback_index: int | None = None) -> SessionViewState:
        entries: list[ConversationEntry] = []
        for message in self.chat_service.get_session(detail.session_id).history():
            if message.role in {"user", "assistant", "tool"}:
                entries.append(ConversationEntry.from_message(message))

        return SessionViewState(
            detail=detail,
            title=self._display_title(detail, fallback_index=fallback_index),
            entries=entries,
        )

    def _hydrate_sessions_from_backend(self) -> None:
        self.sessions.clear()
        self.session_order = []
        for index, summary in enumerate(self.chat_service.list_sessions(), start=1):
            detail = self.chat_service.get_session(summary.session_id).detail()
            self.sessions[detail.session_id] = self._build_session_state(detail, fallback_index=index)
            self.session_order.append(detail.session_id)

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Horizontal(id="app-body"):
            with Vertical(id="sessions-panel"):
                yield Input(placeholder="搜索会话标题 / ID", id="session-search")
                with Horizontal(id="sidebar-actions"):
                    yield Button("新建会话", id="new-session-button", variant="primary")
                    yield Button("删除当前", id="delete-session-button", variant="error")
                yield ListView(id="sessions-list")
                yield Static(id="session-meta")
            with Vertical(id="chat-panel"):
                yield Static(id="active-banner")
                yield VerticalScroll(id="conversation-view")
                with Horizontal(id="composer-actions"):
                    yield Static("Ctrl+S 发送 | Enter 换行 | 步骤会嵌入会话流", id="composer-hint")
                    yield Button("发送", id="send-button", variant="success")
                yield TextArea(
                    "",
                    id="composer",
                    soft_wrap=True,
                    tab_behavior="indent",
                    show_line_numbers=False,
                    placeholder="输入任务、问题或需要 agent 调用工具完成的目标……",
                )
            with Vertical(id="inspector-panel"):
                with TabbedContent(id="inspector-tabs", initial="tab-metrics"):
                    with TabPane("指标", id="tab-metrics"):
                        yield Static(id="metrics-panel")
                    with TabPane("运行时", id="tab-runtime"):
                        yield Static(id="runtime-panel")
                    with TabPane("新会话配置", id="tab-config"):
                        with VerticalScroll(id="config-scroll"):
                            yield Label("会话标题")
                            yield Input(value="新会话", id="config-session-title")
                            yield Label("模型")
                            yield Input(value="gpt-5.4", id="config-model-name")
                            yield Label("Thinking Effort")
                            yield Select(
                                [
                                    ("minimal", "minimal"),
                                    ("low", "low"),
                                    ("medium", "medium"),
                                    ("high", "high"),
                                    ("xhigh", "xhigh"),
                                ],
                                value="medium",
                                allow_blank=False,
                                id="config-effort",
                            )
                            yield Label("Verbosity")
                            yield Select(
                                [("low", "low"), ("medium", "medium"), ("high", "high")],
                                value="medium",
                                allow_blank=False,
                                id="config-verbosity",
                            )
                            yield Checkbox("启用 thinking", value=True, id="config-thinking-enabled")
                            yield Label("超时（秒）")
                            yield Input(value="600", id="config-timeout-seconds")
                            yield Label("业务工具")
                            for tool_name in BUSINESS_TOOL_NAMES:
                                yield Checkbox(
                                    TOOL_LABELS[tool_name],
                                    value=tool_name in ALL_TOOL_NAMES,
                                    id=TOOL_CHECKBOX_IDS[tool_name],
                                )
                            yield Label("系统工具")
                            yield Static(
                                "这些工具会直接访问本地工作目录。文件类工具优先于 bash，路径使用绝对路径。",
                                id="system-tools-hint",
                            )
                            for tool_name in SYSTEM_TOOL_NAMES:
                                yield Checkbox(
                                    TOOL_LABELS[tool_name],
                                    value=tool_name in ALL_TOOL_NAMES,
                                    id=TOOL_CHECKBOX_IDS[tool_name],
                                )
                            yield Label("技能工具")
                            yield Static(
                                "load_skill 用于按需加载 skills/ 目录下的运行时技能说明。",
                                id="skill-tools-hint",
                            )
                            for tool_name in SKILL_TOOL_NAMES:
                                yield Checkbox(
                                    TOOL_LABELS[tool_name],
                                    value=tool_name in ALL_TOOL_NAMES,
                                    id=TOOL_CHECKBOX_IDS[tool_name],
                                )
                            yield Label("运行时提醒")
                            yield Static(
                                "启用工具后，右侧会显示缺失运行时与安装提示；使用第三方 skill 前也请先查看运行时面板。",
                                id="config-runtime-alerts",
                            )
                            yield Label("系统提示词")
                            yield TextArea(
                                "你是一个可靠的中文助理。回答简洁、准确，必要时优先调用工具。",
                                id="config-system-prompt",
                                soft_wrap=True,
                                show_line_numbers=False,
                            )
                            with Horizontal(id="config-actions"):
                                yield Button("从当前会话回填", id="load-current-config", variant="default")
                                yield Button("用以上配置新建", id="create-from-config", variant="primary")
        yield Footer()

    async def on_mount(self) -> None:
        self.chat_service.restore_sessions()
        self._hydrate_sessions_from_backend()
        if self.session_order:
            self._refresh_sessions_list()
            self._set_active_session(self.session_order[0])
        else:
            title_input = self.query_one("#config-session-title", Input)
            title_input.value = self._suggest_next_title()
            self._create_session(self._collect_draft_config())
        self.query_one("#config-session-title", Input).value = self._suggest_next_title()
        self._update_runtime_views()
        self.action_focus_composer()

    def action_new_session(self) -> None:
        self._create_session(self._collect_draft_config())

    def action_focus_search(self) -> None:
        self.query_one("#session-search", Input).focus()

    def action_focus_composer(self) -> None:
        self.query_one("#composer", TextArea).focus()

    def action_focus_sessions(self) -> None:
        self.query_one("#sessions-list", ListView).focus()

    def action_send_message(self) -> None:
        self._submit_message_from_editor()

    def action_delete_session(self) -> None:
        self._delete_active_session()

    def action_clear_active_logs(self) -> None:
        """只清空终端呈现，然后按当前状态重绘。"""

        self.query_one("#conversation-view", VerticalScroll).remove_children()
        if self.active_session_id is not None:
            self._render_session(self.active_session_id)

    @on(Input.Changed, "#session-search")
    def handle_search_change(self, event: Input.Changed) -> None:
        self.session_filter_text = event.value.strip().lower()
        self._refresh_sessions_list()

    @on(Button.Pressed, "#send-button")
    def handle_send_button(self) -> None:
        self._submit_message_from_editor()

    @on(Button.Pressed, "#new-session-button")
    def handle_new_session_button(self) -> None:
        self.action_new_session()

    @on(Button.Pressed, "#delete-session-button")
    def handle_delete_session_button(self) -> None:
        self._delete_active_session()

    @on(Button.Pressed, "#load-current-config")
    def handle_load_current_config(self) -> None:
        if self.active_session_id is None:
            return
        self._populate_draft_from_session(self.sessions[self.active_session_id])

    @on(Button.Pressed, "#create-from-config")
    def handle_create_from_config(self) -> None:
        self.action_new_session()

    @on(Checkbox.Changed)
    def handle_checkbox_changed(self) -> None:
        self._update_runtime_views()

    @on(ListView.Selected, "#sessions-list")
    def handle_session_selected(self, event: ListView.Selected) -> None:
        if event.index < 0 or event.index >= len(self.visible_session_ids):
            return
        self._set_active_session(self.visible_session_ids[event.index])

    def _submit_message_from_editor(self) -> None:
        if self.active_session_id is None:
            return

        composer = self.query_one("#composer", TextArea)
        content = composer.text.strip()
        if not content:
            return

        session = self.chat_service.get_session(self.active_session_id)
        if session._lock.locked():
            self._append_step_entry(
                self.active_session_id,
                "session.error",
                {"message": "当前会话还在处理上一条消息，请稍后再发。"},
            )
            return

        composer.text = ""
        self._append_message_entry(self.active_session_id, ChatMessage.user_message(content))
        self.run_worker(
            self._run_turn(self.active_session_id, content),
            exclusive=False,
            group="chat-turns",
            description="chat-turn",
        )

    async def _run_turn(self, session_id: str, content: str) -> None:
        """后台执行一轮对话，并把中间事件逐条转发回主线程。"""

        session = self.chat_service.get_session(session_id)
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        task = asyncio.create_task(session.ask(content, event_queue=queue))

        try:
            while True:
                if task.done() and queue.empty():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=0.2)
                except asyncio.TimeoutError:
                    continue
                self.post_message(TurnEvent(session_id, event["event"], event["data"]))

            await task
            self.post_message(TurnFinished(session_id, self.chat_service.get_session(session_id).detail()))
        except Exception as exc:
            self.post_message(TurnFailed(session_id, str(exc)))

    def _collect_enabled_tools_from_form(self) -> list[str]:
        return [
            tool_name
            for tool_name, checkbox_id in TOOL_CHECKBOX_IDS.items()
            if self.query_one(f"#{checkbox_id}", Checkbox).value
        ]

    def _collect_draft_config(self) -> SessionCreateRequest:
        enabled_tools = self._collect_enabled_tools_from_form()
        if not enabled_tools:
            enabled_tools = ["office_cli"]

        return SessionCreateRequest(
            title=self.query_one("#config-session-title", Input).value.strip() or self._suggest_next_title(),
            system_prompt=self.query_one("#config-system-prompt", TextArea).text.strip()
            or "你是一个可靠的中文助理。回答简洁、准确，必要时优先调用工具。",
            model_name=self.query_one("#config-model-name", Input).value.strip() or "gpt-5.4",
            max_steps=1024,
            timeout_seconds=float(self.query_one("#config-timeout-seconds", Input).value.strip() or "600"),
            thinking={
                "enabled": self.query_one("#config-thinking-enabled", Checkbox).value,
                "effort": self.query_one("#config-effort", Select).value,
                "verbosity": self.query_one("#config-verbosity", Select).value,
            },
            enabled_tools=enabled_tools,
        )

    def _populate_draft_from_session(self, state: SessionViewState) -> None:
        detail = state.detail
        self.query_one("#config-session-title", Input).value = self._display_title(detail)
        self.query_one("#config-model-name", Input).value = detail.model_name
        self.query_one("#config-thinking-enabled", Checkbox).value = detail.thinking.enabled
        self.query_one("#config-timeout-seconds", Input).value = str(int(detail.timeout_seconds or 600))
        self.query_one("#config-effort", Select).value = detail.thinking.effort or "medium"
        self.query_one("#config-verbosity", Select).value = detail.thinking.verbosity or "medium"
        self.query_one("#config-system-prompt", TextArea).text = detail.system_prompt
        for tool_name, checkbox_id in TOOL_CHECKBOX_IDS.items():
            self.query_one(f"#{checkbox_id}", Checkbox).value = tool_name in detail.enabled_tools
        self._update_runtime_views()

    def _create_session(self, config: SessionCreateRequest) -> None:
        detail = self.chat_service.create_session(config)
        self.session_counter = max(self.session_counter, len(self.session_order) + 1)
        title_input = self.query_one("#config-session-title", Input)
        self.sessions[detail.session_id] = self._build_session_state(
            detail,
            fallback_index=self.session_counter,
        )
        self.session_order.append(detail.session_id)
        self._refresh_sessions_list()
        self._set_active_session(detail.session_id)
        title_input.value = self._suggest_next_title()
        self._update_runtime_views()

    def _delete_active_session(self) -> None:
        if self.active_session_id is None:
            return
        session_id = self.active_session_id
        self.chat_service.delete_session(session_id)
        self.sessions.pop(session_id, None)
        self.session_order = [item for item in self.session_order if item != session_id]

        if not self.session_order:
            self.active_session_id = None
            self._create_session(self._collect_draft_config())
            return

        self.active_session_id = None
        self._refresh_sessions_list()
        self._set_active_session(self.session_order[0])

    def _refresh_sessions_list(self) -> None:
        sessions_list = self.query_one("#sessions-list", ListView)
        sessions_list.clear()
        self.visible_session_ids = []

        for session_id in self.session_order:
            state = self.sessions[session_id]
            summary = self.chat_service.get_session(session_id).summary()
            state.detail = self.chat_service.get_session(session_id).detail()
            state.title = self._display_title(state.detail, fallback_index=self.session_order.index(session_id) + 1)
            haystack = f"{state.title} {summary.session_id} {summary.model_name}".lower()
            if self.session_filter_text and self.session_filter_text not in haystack:
                continue
            self.visible_session_ids.append(session_id)
            sessions_list.append(ListItem(Label(self._build_session_label(state, summary))))

        if self.active_session_id in self.visible_session_ids:
            sessions_list.index = self.visible_session_ids.index(self.active_session_id)
        elif self.visible_session_ids:
            sessions_list.index = 0

    def _build_session_label(self, state: SessionViewState, summary: SessionSummary) -> Text:
        text = Text()
        is_active = summary.session_id == self.active_session_id
        dot = "● " if is_active else "○ "
        text.append(dot, style="bold #8bd3dd" if is_active else "#6b7280")
        text.append(truncate_text(state.title, 16), style="bold #f8fafc")
        text.append(f"\n{summary.session_id[:8]}", style="#94a3b8")
        text.append(f"  {summary.model_name}", style="#a7f3d0")
        text.append(f"  {summary.message_count}条", style="#f9a8d4")
        if summary.total_cost_usd is not None:
            text.append(f"\n${summary.total_cost_usd:.5f}", style="#fde68a")
        return text

    def _set_active_session(self, session_id: str) -> None:
        self.active_session_id = session_id
        self._refresh_sessions_list()
        self._render_session(session_id)
        self._update_runtime_views()

    def _render_session(self, session_id: str) -> None:
        conversation_view = self.query_one("#conversation-view", VerticalScroll)
        conversation_view.remove_children()

        state = self.sessions[session_id]
        self.query_one("#active-banner", Static).update(self._build_banner(state))
        self.query_one("#session-meta", Static).update(self._build_session_meta(state))
        self.query_one("#metrics-panel", Static).update(self._build_metrics_panel(state))
        self.query_one("#runtime-panel", Static).update(self._build_runtime_panel())

        for entry in state.entries:
            conversation_view.mount(self._build_conversation_widget(entry))
        conversation_view.scroll_end(animate=False)
        self.sub_title = f"{state.title} · {state.detail.model_name}"

    def _build_banner(self, state: SessionViewState) -> Panel:
        detail = state.detail
        status = self.chat_service.get_session(detail.session_id).summary().status
        enabled_tools = ", ".join(detail.enabled_tools[:4]) if detail.enabled_tools else "无工具"
        more_tools = ""
        if len(detail.enabled_tools) > 4:
            more_tools = f" +{len(detail.enabled_tools) - 4}"
        line = Text()
        line.append(f"{state.title}", style="bold #f8fafc")
        line.append("  ")
        line.append(detail.session_id[:8], style="#94a3b8")
        line.append("  ")
        line.append(detail.model_name, style="#86efac")
        line.append("  ")
        line.append(f"max_steps={detail.max_steps}", style="#fbbf24")
        line.append("  ")
        line.append(f"timeout={int(detail.timeout_seconds or 0)}s", style="#f59e0b")
        line.append("  ")
        line.append(status, style="#93c5fd")
        line.append("\n")
        line.append("tools ", style="#64748b")
        line.append(enabled_tools, style="#cbd5e1")
        if more_tools:
            line.append(more_tools, style="#fca5a5")
        return Panel(line, border_style="#334155", title="当前会话", title_align="left")

    def _build_session_meta(self, state: SessionViewState) -> Panel:
        summary = self.chat_service.get_session(state.detail.session_id).summary()
        table = Table.grid(padding=(0, 1))
        table.add_column(style="bold #cbd5e1")
        table.add_column(style="#f8fafc")
        table.add_row("标题", state.title)
        table.add_row("ID", summary.session_id[:12])
        table.add_row("消息", str(summary.message_count))
        table.add_row("状态", summary.status)
        table.add_row("步骤卡片", str(sum(1 for entry in state.entries if entry.kind == "step")))
        if summary.trace_log_dir:
            table.add_row("Trace", truncate_text(summary.trace_log_dir, 28))
        if summary.total_cost_usd is not None:
            table.add_row("成本", f"${summary.total_cost_usd:.5f}")
        return Panel(table, border_style="#2c3e50", title="会话信息", title_align="left")

    def _build_metrics_panel(self, state: SessionViewState) -> Panel:
        detail = state.detail
        summary = self.chat_service.get_session(detail.session_id).summary()
        metrics_table = Table.grid(padding=(0, 1))
        metrics_table.add_column(style="bold #cbd5e1")
        metrics_table.add_column(style="#f8fafc")
        metrics_table.add_row("模型", detail.model_name)
        metrics_table.add_row("Max Steps", str(detail.max_steps))
        metrics_table.add_row("超时", f"{int(detail.timeout_seconds or 0)}s")
        metrics_table.add_row(
            "Thinking",
            f"{'on' if detail.thinking.enabled else 'off'} / {detail.thinking.effort or 'none'}",
        )
        metrics_table.add_row("Verbosity", detail.thinking.verbosity or "default")
        metrics_table.add_row("上下文", detail.context_window.get("percent", "0%"))
        metrics_table.add_row("总 Prompt", str(summary.total_usage.get("prompt_tokens", 0)))
        metrics_table.add_row("总 Completion", str(summary.total_usage.get("completion_tokens", 0)))
        if summary.total_cost_usd is not None:
            metrics_table.add_row("累计成本", f"${summary.total_cost_usd:.5f}")
        if detail.multi_agent_enabled:
            metrics_table.add_row("多代理", f"on / {detail.specialist_count} specialists")

        relevant_runtime_checks = runtime_checks_for_enabled_tools(detail.enabled_tools)
        missing_runtime_checks = [item for item in relevant_runtime_checks if item.status == "missing"]
        if missing_runtime_checks:
            metrics_table.add_row("-", "-")
            metrics_table.add_row("运行时缺失", str(len(missing_runtime_checks)))
            metrics_table.add_row(
                "缺失项",
                truncate_text(", ".join(item.requirement.label for item in missing_runtime_checks), 36),
            )

        if state.last_metrics is not None:
            metrics_table.add_row("-", "-")
            metrics_table.add_row("本轮 Prompt", str(state.last_metrics.turn_usage.get("prompt_tokens", 0)))
            metrics_table.add_row("本轮 Completion", str(state.last_metrics.turn_usage.get("completion_tokens", 0)))
            if state.last_metrics.turn_cost_usd is not None:
                metrics_table.add_row("本轮成本", f"${state.last_metrics.turn_cost_usd:.5f}")

        if detail.last_error:
            metrics_table.add_row("最近错误", truncate_text(detail.last_error, 40))

        return Panel(metrics_table, border_style="#3b4252", title="指标与成本", title_align="left")

    def _build_conversation_widget(self, entry: ConversationEntry):
        if entry.kind == "message" and entry.message is not None:
            return MessageRow(entry.message)
        if entry.kind == "step" and entry.step is not None:
            return StepRow(entry.step)
        return Static("")

    def _close_last_running_step(
        self,
        session_id: str,
        new_status: Literal["completed", "error"],
    ) -> bool:
        """把最后一个运行中的步骤收口。

        当新的 assistant.step 到来时，说明上一个步骤已经结束；
        当 assistant.final 到来时，说明最后一个步骤已经成功完成；
        当失败事件到来时，则把最后一个运行中步骤标记为失败。
        """

        state = self.sessions[session_id]
        for entry in reversed(state.entries):
            if entry.kind == "step" and entry.step is not None and entry.step.status == "running":
                entry.step.status = new_status
                if session_id == self.active_session_id:
                    self._render_session(session_id)
                return True
        return False

    def _append_message_entry(self, session_id: str, message: ChatMessage) -> None:
        state = self.sessions[session_id]
        entry = ConversationEntry.from_message(message)
        state.entries.append(entry)
        if session_id == self.active_session_id:
            conversation_view = self.query_one("#conversation-view", VerticalScroll)
            conversation_view.mount(self._build_conversation_widget(entry))
            conversation_view.scroll_end(animate=False)

    def _append_step_entry(self, session_id: str, event_name: str, payload: dict[str, Any]) -> None:
        timestamp = payload.get("timestamp", "")[-8:] if payload.get("timestamp") else "--:--:--"
        entry = StepEventEntry(
            timestamp=timestamp,
            event_name=event_name,
            summary=summarize_step_event(event_name, payload),
            status=default_step_status(event_name),
            payload=payload,
        )
        state = self.sessions[session_id]
        conversation_entry = ConversationEntry.from_step(entry)
        state.entries.append(conversation_entry)
        if session_id == self.active_session_id:
            conversation_view = self.query_one("#conversation-view", VerticalScroll)
            conversation_view.mount(self._build_conversation_widget(conversation_entry))
            conversation_view.scroll_end(animate=False)

    def _build_runtime_panel(self) -> Panel:
        checks = collect_runtime_checks()
        ready_count = sum(1 for item in checks if item.status == "ready")
        missing_count = sum(1 for item in checks if item.status == "missing")
        manual_count = sum(1 for item in checks if item.status == "manual")
        draft_enabled_tools = self._collect_enabled_tools_from_form()
        relevant_tool_checks = runtime_checks_for_enabled_tools(draft_enabled_tools)
        skill_checks = collect_skill_runtime_checks()
        missing_skill_checks = [item for item in skill_checks if item.status == "missing"]

        table = Table.grid(padding=(0, 1))
        table.add_column(style="bold #94a3b8", ratio=1)
        table.add_column(style="#e5eef8", ratio=2)
        table.add_row("文档", str(RUNTIME_DOC_PATH))
        table.add_row("总览", f"{ready_count} ready / {missing_count} missing / {manual_count} manual")
        table.add_row(
            "草稿工具",
            ", ".join(draft_enabled_tools) if draft_enabled_tools else "当前未启用任何工具",
        )
        if self.active_session_id:
            detail = self.sessions[self.active_session_id].detail
            table.add_row("当前会话", detail.session_id[:12])
            if detail.trace_log_dir:
                table.add_row("Trace", truncate_text(detail.trace_log_dir, 44))

        if relevant_tool_checks:
            table.add_row("-", "-")
            for check in relevant_tool_checks:
                table.add_row(
                    f"{status_emoji(check.status)} {check.requirement.label}",
                    truncate_text(check.detail, 62),
                )
        if "load_skill" in draft_enabled_tools:
            table.add_row("-", "-")
            table.add_row(
                "SKILL 提醒",
                f"load_skill 已启用，当前共有 {len(missing_skill_checks)} 项 skill 运行时缺失。",
            )
            for check in missing_skill_checks[:5]:
                table.add_row(
                    f"NO {check.requirement.label}",
                    truncate_text(", ".join(check.requirement.required_by), 62),
                )
            if len(missing_skill_checks) > 5:
                table.add_row("更多", f"还有 {len(missing_skill_checks) - 5} 项，详见运行时文档")

        return Panel(table, border_style="#334155", title="运行时与依赖", title_align="left")

    def _build_runtime_alerts(self) -> Panel:
        draft_enabled_tools = self._collect_enabled_tools_from_form()
        relevant_checks = runtime_checks_for_enabled_tools(draft_enabled_tools)
        missing_checks = [item for item in relevant_checks if item.status == "missing"]

        body = Table.grid(padding=(0, 1))
        body.add_column(style="bold #94a3b8")
        body.add_column(style="#e5eef8")
        body.add_row("文档", str(RUNTIME_DOC_PATH))
        if not draft_enabled_tools:
            body.add_row("提示", "当前未启用任何工具。")
            return Panel(body, border_style="#334155", title="运行时提醒", title_align="left")

        if not missing_checks:
            body.add_row("状态", "当前草稿启用工具的基础运行时已就绪。")
            if "load_skill" in draft_enabled_tools:
                body.add_row("技能", "第三方 skill 仍可能需要额外运行时，详见运行时文档。")
            return Panel(body, border_style="#065f46", title="运行时提醒", title_align="left")

        for check in missing_checks:
            body.add_row(check.requirement.label, truncate_text(check.requirement.install_hint, 70))
        return Panel(body, border_style="#b45309", title="运行时提醒", title_align="left")

    def _update_runtime_views(self) -> None:
        if not self.is_mounted:
            return
        self.query_one("#runtime-panel", Static).update(self._build_runtime_panel())
        self.query_one("#config-runtime-alerts", Static).update(self._build_runtime_alerts())

    def on_turn_event(self, message: TurnEvent) -> None:
        state = self.sessions[message.session_id]
        if message.event_name == "assistant.step":
            self._close_last_running_step(message.session_id, "completed")
            self._append_step_entry(message.session_id, message.event_name, message.payload)
        elif message.event_name == "session.started":
            self._append_step_entry(message.session_id, message.event_name, message.payload)
        elif message.event_name == "session.error":
            if not self._close_last_running_step(message.session_id, "error"):
                self._append_step_entry(message.session_id, message.event_name, message.payload)
        elif message.event_name == "done":
            self._close_last_running_step(message.session_id, "completed")
        if message.event_name == "assistant.final":
            self._close_last_running_step(message.session_id, "completed")
            metrics_payload = message.payload.get("metrics") or {}
            state.last_metrics = TurnMetrics.model_validate(metrics_payload)
            assistant_payload = message.payload.get("assistant") or {}
            assistant = ChatMessage.model_validate(assistant_payload)
            self._append_message_entry(message.session_id, assistant)
            if message.session_id == self.active_session_id:
                self.query_one("#metrics-panel", Static).update(self._build_metrics_panel(state))

    def on_turn_finished(self, message: TurnFinished) -> None:
        state = self.sessions[message.session_id]
        state.detail = message.detail
        self._refresh_sessions_list()
        if message.session_id == self.active_session_id:
            self.query_one("#active-banner", Static).update(self._build_banner(state))
            self.query_one("#session-meta", Static).update(self._build_session_meta(state))
            self.query_one("#metrics-panel", Static).update(self._build_metrics_panel(state))
            self._populate_draft_from_session(state)
            self.query_one("#runtime-panel", Static).update(self._build_runtime_panel())

    def on_turn_failed(self, message: TurnFailed) -> None:
        if message.session_id not in self.sessions:
            return
        state = self.sessions[message.session_id]
        state.detail = self.chat_service.get_session(message.session_id).detail()
        state.last_metrics = None
        if not self._close_last_running_step(message.session_id, "error"):
            self._append_step_entry(
                message.session_id,
                "session.error",
                {"message": message.error_text},
            )
        if message.session_id == self.active_session_id:
            self.query_one("#metrics-panel", Static).update(self._build_metrics_panel(state))
            self.query_one("#runtime-panel", Static).update(self._build_runtime_panel())
