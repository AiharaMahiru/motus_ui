from __future__ import annotations

from dataclasses import dataclass, field
import asyncio

from core.schemas.preview import PreviewRunResponse

MAX_LOG_LENGTH = 30_000
TERMINAL_PREVIEW_COLS = 100
TERMINAL_PREVIEW_ROWS = 32


@dataclass
class TerminalScreenBuffer:
    cols: int = TERMINAL_PREVIEW_COLS
    rows: int = TERMINAL_PREVIEW_ROWS
    lines: list[list[str]] = field(init=False)
    cursor_col: int = 0
    cursor_row: int = 0
    escape_buffer: str | None = None

    def __post_init__(self) -> None:
        self.lines = [[" "] * self.cols for _ in range(self.rows)]

    def feed(self, text: str) -> None:
        for char in text:
            if self.escape_buffer is not None:
                self._feed_escape(char)
                continue

            if char == "\x1b":
                self.escape_buffer = ""
                continue
            if char == "\r":
                self.cursor_col = 0
                continue
            if char == "\n":
                self._newline()
                continue
            if char == "\b":
                self.cursor_col = max(0, self.cursor_col - 1)
                continue
            if char == "\t":
                spaces = 4 - (self.cursor_col % 4)
                for _ in range(spaces):
                    self._write_char(" ")
                continue
            if ord(char) < 32:
                continue

            self._write_char(char)

    def render(self) -> str:
        rendered_lines = ["".join(line).rstrip() for line in self.lines]
        while rendered_lines and not rendered_lines[-1]:
            rendered_lines.pop()
        return "\n".join(rendered_lines)

    def clear(self) -> None:
        self.lines = [[" "] * self.cols for _ in range(self.rows)]
        self.cursor_col = 0
        self.cursor_row = 0

    def resize(self, cols: int, rows: int) -> None:
        old_lines = self.lines
        old_cols = self.cols
        old_rows = self.rows

        self.cols = cols
        self.rows = rows
        self.lines = [[" "] * cols for _ in range(rows)]

        copy_rows = min(old_rows, rows)
        copy_cols = min(old_cols, cols)
        row_offset_old = max(0, old_rows - copy_rows)
        row_offset_new = max(0, rows - copy_rows)

        for row_index in range(copy_rows):
            old_row = old_lines[row_offset_old + row_index]
            self.lines[row_offset_new + row_index][:copy_cols] = old_row[:copy_cols]

        self.cursor_row = min(self.cursor_row, rows - 1)
        self.cursor_col = min(self.cursor_col, cols - 1)

    def _feed_escape(self, char: str) -> None:
        current = (self.escape_buffer or "") + char
        self.escape_buffer = current

        if not current.startswith("["):
            self.escape_buffer = None
            return

        if len(current) > 32:
            self.escape_buffer = None
            return

        final_char = current[-1]
        if not (final_char.isalpha() or final_char in "@`~"):
            return

        self._apply_csi(current)
        self.escape_buffer = None

    def _apply_csi(self, sequence: str) -> None:
        params_text = sequence[1:-1]
        final_char = sequence[-1]
        private_mode = params_text.startswith("?")
        if private_mode:
            params_text = params_text[1:]

        params = [int(item) if item else 0 for item in params_text.split(";")] if params_text else []

        if final_char in {"H", "f"}:
            row = (params[0] if len(params) >= 1 and params[0] else 1) - 1
            col = (params[1] if len(params) >= 2 and params[1] else 1) - 1
            self.cursor_row = min(max(row, 0), self.rows - 1)
            self.cursor_col = min(max(col, 0), self.cols - 1)
            return

        if final_char == "J":
            mode = params[0] if params else 0
            if mode == 2:
                self.clear()
            return

        if final_char == "K":
            mode = params[0] if params else 0
            if mode == 2:
                self.lines[self.cursor_row] = [" "] * self.cols
            elif mode == 1:
                for index in range(0, self.cursor_col + 1):
                    self.lines[self.cursor_row][index] = " "
            else:
                for index in range(self.cursor_col, self.cols):
                    self.lines[self.cursor_row][index] = " "
            return

        if final_char == "A":
            self.cursor_row = max(0, self.cursor_row - (params[0] if params and params[0] else 1))
            return
        if final_char == "B":
            self.cursor_row = min(self.rows - 1, self.cursor_row + (params[0] if params and params[0] else 1))
            return
        if final_char == "C":
            self.cursor_col = min(self.cols - 1, self.cursor_col + (params[0] if params and params[0] else 1))
            return
        if final_char == "D":
            self.cursor_col = max(0, self.cursor_col - (params[0] if params and params[0] else 1))
            return

        if final_char in {"m", "h", "l"}:
            return

    def _newline(self) -> None:
        self.cursor_col = 0
        self.cursor_row += 1
        if self.cursor_row < self.rows:
            return
        self.lines.pop(0)
        self.lines.append([" "] * self.cols)
        self.cursor_row = self.rows - 1

    def _write_char(self, char: str) -> None:
        if self.cursor_col >= self.cols:
            self._newline()
        self.lines[self.cursor_row][self.cursor_col] = char
        self.cursor_col += 1


@dataclass
class TerminalPreviewSession:
    response: PreviewRunResponse
    process: asyncio.subprocess.Process
    master_fd: int
    screen: TerminalScreenBuffer
    transcript_tail: str = ""
    reader_task: asyncio.Task[None] | None = None
    terminated_by_user: bool = False


def truncate_text(value: str | None) -> str | None:
    if value is None:
        return None
    if len(value) <= MAX_LOG_LENGTH:
        return value
    return value[:MAX_LOG_LENGTH] + "\n...[truncated]"
