from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


PreviewLanguage = Literal["html", "react", "jsx", "tsx", "python", "py"]
PreviewArtifactKind = Literal["html", "image", "text"]
PreviewStatus = Literal["running", "completed", "error"]
PreviewMode = Literal["artifact", "terminal"]


class PreviewRunRequest(BaseModel):
    """会话内代码预览请求。"""

    language: PreviewLanguage
    code: str = Field(min_length=1, max_length=200_000)
    title: str | None = Field(default=None, max_length=120)


class PreviewArtifact(BaseModel):
    """可供前端渲染的预览产物。"""

    kind: PreviewArtifactKind
    file_name: str
    content_type: str
    url: str | None = None
    text_content: str | None = None


class PreviewTerminalState(BaseModel):
    """终端型预览的会话状态。"""

    cols: int = 100
    rows: int = 32
    screen_text: str = ""
    transcript_tail: str | None = None
    can_write_stdin: bool = False
    exit_code: int | None = None


class PreviewTerminalInputRequest(BaseModel):
    """向终端型预览写入 stdin。"""

    text: str = Field(default="", max_length=4_000)
    append_newline: bool = True


class PreviewTerminalResizeRequest(BaseModel):
    """调整终端型预览的行列数。"""

    cols: int = Field(default=100, ge=40, le=240)
    rows: int = Field(default=32, ge=12, le=80)


class PreviewRunResponse(BaseModel):
    """单次预览执行结果。"""

    run_id: str
    session_id: str
    language: PreviewLanguage
    normalized_language: Literal["html", "react", "python"]
    mode: PreviewMode = "artifact"
    status: PreviewStatus
    title: str | None = None
    created_at: str
    completed_at: str | None = None
    command: str | None = None
    run_dir: str
    source_file: str
    artifact: PreviewArtifact | None = None
    terminal: PreviewTerminalState | None = None
    stdout: str | None = None
    stderr: str | None = None
    error: str | None = None
