from __future__ import annotations

import importlib.util
import os
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from core.config.paths import PROJECT_ROOT


RuntimeStatus = Literal["ready", "missing", "manual"]


@dataclass(frozen=True)
class RuntimeRequirement:
    """单个运行时依赖声明。"""

    key: str
    label: str
    category: Literal["tool", "mcp", "skill", "shared"]
    requirement_type: Literal["binary", "env", "module", "service", "file", "stack"]
    summary: str
    install_hint: str
    required_by: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    binaries: list[str] = field(default_factory=list)
    env_vars: list[str] = field(default_factory=list)
    modules: list[str] = field(default_factory=list)
    files: list[str] = field(default_factory=list)
    manual: bool = False


@dataclass(frozen=True)
class RuntimeCheckResult:
    """运行时依赖检测结果。"""

    requirement: RuntimeRequirement
    status: RuntimeStatus
    detail: str


def _user_home() -> Path:
    return Path.home()


RUNTIME_REQUIREMENTS: list[RuntimeRequirement] = [
    RuntimeRequirement(
        key="python-runtime",
        label="Python 3 / uv",
        category="shared",
        requirement_type="stack",
        summary="当前 agent 项目自己的核心运行时，项目脚本、skill_creator 和多数自动化流程依赖它。",
        install_hint="安装 Python 3.14 与 uv，并确保 `uv run ...` 可用。",
        required_by=["项目主服务", "skill_creator", "smoke scripts"],
        binaries=["uv"],
    ),
    RuntimeRequirement(
        key="firecrawl-key",
        label="FIRECRAWL_KEY",
        category="tool",
        requirement_type="env",
        summary="网页搜索/抓取/交互工具的鉴权凭据。",
        install_hint="在项目根目录 `.env` 中配置 `FIRECRAWL_KEY=...`。",
        required_by=["web_search", "web_scrape", "web_interact", "web_research"],
        env_vars=["FIRECRAWL_KEY"],
    ),
    RuntimeRequirement(
        key="officecli",
        label="officecli CLI",
        category="tool",
        requirement_type="binary",
        summary="Office 文档读写执行引擎，缺失时 `office_cli` 和 `office_documents` 无法真正操作文件。",
        install_hint="按 `tools/integrations/officecli/SKILL.md` 安装 `officecli` 并确认 `officecli --version` 可用。",
        required_by=["office_cli", "office_documents"],
        binaries=["officecli"],
    ),
    RuntimeRequirement(
        key="mcp-remote-http",
        label="Remote HTTP MCP 服务",
        category="mcp",
        requirement_type="service",
        summary="`remote_http` 模式要求远端 MCP 服务可达。",
        install_hint="准备可访问的 MCP URL，并通过 `SessionCreateRequest.mcp_servers` 提供 `url` 与必要的 headers。",
        required_by=["MCP remote_http"],
        notes=["这是外部服务依赖，项目无法在本地自动安装。"],
        manual=True,
    ),
    RuntimeRequirement(
        key="mcp-local-stdio",
        label="Local stdio MCP 命令",
        category="mcp",
        requirement_type="binary",
        summary="`local_stdio` 模式要求指定命令存在于本机 PATH，或能通过绝对路径启动。",
        install_hint="例如配置 `npx @playwright/mcp`，并先确认 `npx` 或目标命令可以在终端启动。",
        required_by=["MCP local_stdio"],
        notes=["这是按具体 MCP server 配置动态决定的，TUI 只能做通用提醒。"],
        binaries=[],
        manual=True,
    ),
    RuntimeRequirement(
        key="node-npm",
        label="Node.js / npm",
        category="skill",
        requirement_type="binary",
        summary="多项第三方前端/多媒体 skill 依赖 Node.js 生态安装 CLI 或包。",
        install_hint="安装 Node.js LTS，并确认 `node -v`、`npm -v` 可用。",
        required_by=[
            "frontend-dev",
            "react-native-dev",
            "pptx-generator",
            "buddy-sings",
            "mmx-cli",
            "minimax-music-gen",
            "minimax-music-playlist",
        ],
        binaries=["node", "npm"],
    ),
    RuntimeRequirement(
        key="mmx-cli",
        label="mmx CLI 已安装并认证",
        category="skill",
        requirement_type="file",
        summary="MiniMax 多模态 skill 的实际执行入口，需先安装 CLI 并完成认证。",
        install_hint="执行 `npm install -g mmx-cli`，然后运行 `mmx auth login --api-key <your-key>`。",
        required_by=[
            "mmx-cli",
            "buddy-sings",
            "minimax-music-gen",
            "minimax-music-playlist",
        ],
        binaries=["mmx"],
        files=[str(_user_home() / ".mmx" / "credentials.json")],
    ),
    RuntimeRequirement(
        key="minimax-api-key",
        label="MINIMAX_API_KEY / MiniMax Token Plan",
        category="skill",
        requirement_type="env",
        summary="部分 MiniMax skill 直接依赖 API Key 或 Token Plan 权限。",
        install_hint="在对应环境中配置 `MINIMAX_API_KEY`，并确认账号具备所需套餐或视觉 Token Plan 权限。",
        required_by=["vision-analysis", "gif-sticker-maker", "frontend-dev(生成媒体资产)"],
        env_vars=["MINIMAX_API_KEY"],
        notes=["`vision-analysis` 额外要求 MiniMax Token Plan，不是普通 API key 即可替代。"],
    ),
    RuntimeRequirement(
        key="ffmpeg",
        label="FFmpeg",
        category="skill",
        requirement_type="binary",
        summary="多媒体处理、GIF 转换、音视频后处理依赖 FFmpeg。",
        install_hint="安装 FFmpeg，并确认 `ffmpeg -version` 可用。",
        required_by=["gif-sticker-maker", "mmx-cli(媒体处理)", "frontend-dev(生成媒体后处理)"],
        binaries=["ffmpeg"],
    ),
    RuntimeRequirement(
        key="dotnet8",
        label=".NET SDK 8+",
        category="skill",
        requirement_type="binary",
        summary="`minimax-docx` 的 OpenXML CLI 与 C# 脚本运行时。",
        install_hint="安装 .NET SDK 8+，并确认 `dotnet --version` >= 8。",
        required_by=["minimax-docx"],
        binaries=["dotnet"],
    ),
    RuntimeRequirement(
        key="markitdown",
        label="markitdown Python 模块",
        category="skill",
        requirement_type="module",
        summary="`pptx-generator` 读取/分析 PPTX 时依赖 markitdown。",
        install_hint='执行 `pip install "markitdown[pptx]"`。',
        required_by=["pptx-generator"],
        modules=["markitdown"],
    ),
    RuntimeRequirement(
        key="pptxgenjs",
        label="PptxGenJS / Node 包",
        category="skill",
        requirement_type="stack",
        summary="`pptx-generator` 从零创建 PPTX 时依赖 Node.js 与 PptxGenJS。",
        install_hint="先安装 Node.js，再执行 `npm install -g pptxgenjs`；如需图标和图片处理，再安装 `react-icons react react-dom sharp`。",
        required_by=["pptx-generator"],
        binaries=["node", "npm"],
        notes=["当前仅能检测 Node/npm 是否存在，PptxGenJS 包本身需按 skill 文档安装。"],
    ),
    RuntimeRequirement(
        key="pandas",
        label="pandas Python 模块",
        category="skill",
        requirement_type="module",
        summary="`minimax-xlsx` 读取和分析电子表格时依赖 pandas。",
        install_hint="执行 `pip install pandas`。",
        required_by=["minimax-xlsx"],
        modules=["pandas"],
    ),
    RuntimeRequirement(
        key="libreoffice",
        label="LibreOffice / soffice",
        category="skill",
        requirement_type="binary",
        summary="`minimax-xlsx` 做公式重算与验证时的可选增强运行时。",
        install_hint="安装 LibreOffice，并确认 `libreoffice` 或 `soffice` 可用。",
        required_by=["minimax-xlsx(动态重算/验证)"],
        binaries=["libreoffice", "soffice"],
        notes=["这是增强能力，不装也能做部分 XML 级编辑。"],
    ),
    RuntimeRequirement(
        key="playwright-chromium",
        label="Playwright + Chromium",
        category="skill",
        requirement_type="stack",
        summary="`minimax-pdf` 的部分封面渲染链路依赖 Playwright 与 Chromium。",
        install_hint="执行 `npm install -g playwright && npx playwright install chromium`。",
        required_by=["minimax-pdf"],
        binaries=["npx"],
        notes=["当前只检测 `npx`；浏览器下载需按 skill 文档单独执行。"],
    ),
    RuntimeRequirement(
        key="reportlab-pypdf",
        label="reportlab / pypdf",
        category="skill",
        requirement_type="module",
        summary="`minimax-pdf` 的 PDF 生成、填充、合并链路依赖 Python 包。",
        install_hint="执行 `pip install reportlab pypdf`。",
        required_by=["minimax-pdf"],
        modules=["reportlab", "pypdf"],
    ),
    RuntimeRequirement(
        key="flutter-sdk",
        label="Flutter SDK",
        category="skill",
        requirement_type="binary",
        summary="`flutter-dev` 属于执行型开发技能，实际构建、运行、分析依赖 Flutter SDK。",
        install_hint="安装 Flutter SDK，并确认 `flutter doctor` 可运行。",
        required_by=["flutter-dev"],
        binaries=["flutter"],
    ),
    RuntimeRequirement(
        key="android-sdk",
        label="Android SDK / Gradle / JDK",
        category="skill",
        requirement_type="stack",
        summary="`android-native-dev` 的构建、安装和调试链路依赖 Android 工具链。",
        install_hint="安装 Android Studio 或独立 Android SDK、JDK，并确保 `./gradlew` 或 `gradle` 可用。",
        required_by=["android-native-dev"],
        binaries=["java", "gradle"],
        notes=["项目级 Android 工程通常还需要 `gradlew` 包装脚本。"],
    ),
    RuntimeRequirement(
        key="xcode",
        label="Xcode / xcodebuild",
        category="skill",
        requirement_type="binary",
        summary="`ios-application-dev` 的真实构建、签名、模拟器调试依赖 Xcode。",
        install_hint="在 macOS 安装 Xcode，并确认 `xcodebuild -version` 可用。",
        required_by=["ios-application-dev"],
        binaries=["xcodebuild"],
    ),
    RuntimeRequirement(
        key="expo-cli-stack",
        label="Expo / React Native Node 工具链",
        category="skill",
        requirement_type="stack",
        summary="`react-native-dev` 的开发、调试、依赖安装依赖 Node.js 与 Expo 工具链。",
        install_hint="安装 Node.js，并按项目执行 `npx expo install ...` 或对应依赖安装命令。",
        required_by=["react-native-dev"],
        binaries=["node", "npm", "npx"],
    ),
    RuntimeRequirement(
        key="guide-only-skills",
        label="指导型技能（无统一硬运行时）",
        category="skill",
        requirement_type="service",
        summary="部分 skill 主要提供工程指导，本身没有统一的硬运行时门槛，但实际项目仍取决于目标技术栈。",
        install_hint="按具体项目技术栈准备运行时；这些 skill 更像高质量开发手册而不是即插即用 CLI。",
        required_by=["fullstack-dev", "shader-dev"],
        manual=True,
        notes=["这类 skill 不应被误认为“安装后就能直接执行”。"],
    ),
]


def probe_runtime(requirement: RuntimeRequirement) -> RuntimeCheckResult:
    """检测单个运行时依赖的本地状态。"""

    if requirement.manual:
        return RuntimeCheckResult(
            requirement=requirement,
            status="manual",
            detail="该项依赖需要用户按项目场景自行配置，当前仅做文档提醒。",
        )

    missing_bits: list[str] = []

    for env_var in requirement.env_vars:
        if not os.getenv(env_var):
            missing_bits.append(f"环境变量 {env_var}")

    for binary in requirement.binaries:
        if shutil.which(binary) is None:
            missing_bits.append(f"命令 {binary}")

    for module in requirement.modules:
        if importlib.util.find_spec(module) is None:
            missing_bits.append(f"Python 模块 {module}")

    for file_path in requirement.files:
        if not Path(file_path).expanduser().exists():
            missing_bits.append(f"文件 {Path(file_path).expanduser()}")

    if missing_bits:
        return RuntimeCheckResult(
            requirement=requirement,
            status="missing",
            detail="缺失：" + "、".join(missing_bits),
        )

    ready_detail = "已满足当前检测条件。"
    if requirement.binaries:
        resolved = [f"{name}={shutil.which(name)}" for name in requirement.binaries if shutil.which(name)]
        if resolved:
            ready_detail = "；".join(resolved)

    return RuntimeCheckResult(
        requirement=requirement,
        status="ready",
        detail=ready_detail,
    )


def collect_runtime_checks() -> list[RuntimeCheckResult]:
    """收集全部运行时依赖检测结果。"""

    return [probe_runtime(requirement) for requirement in RUNTIME_REQUIREMENTS]


def collect_tool_runtime_checks() -> list[RuntimeCheckResult]:
    return [item for item in collect_runtime_checks() if item.requirement.category == "tool"]


def collect_mcp_runtime_checks() -> list[RuntimeCheckResult]:
    return [item for item in collect_runtime_checks() if item.requirement.category == "mcp"]


def collect_skill_runtime_checks() -> list[RuntimeCheckResult]:
    return [item for item in collect_runtime_checks() if item.requirement.category == "skill"]


def runtime_checks_for_enabled_tools(enabled_tools: list[str]) -> list[RuntimeCheckResult]:
    """根据当前启用工具过滤最相关的运行时依赖。"""

    enabled = set(enabled_tools)
    relevant: list[RuntimeCheckResult] = []
    for check in collect_runtime_checks():
        if any(item in enabled for item in check.requirement.required_by):
            relevant.append(check)
    return relevant


def render_runtime_requirements_markdown() -> str:
    """生成统一的运行时依赖文档。"""

    checks = collect_runtime_checks()
    ready_count = sum(1 for item in checks if item.status == "ready")
    missing_count = sum(1 for item in checks if item.status == "missing")
    manual_count = sum(1 for item in checks if item.status == "manual")

    lines = [
        "# 运行时依赖说明",
        "",
        "这份文档用于说明当前项目中 `skills / tools / mcp` 的可执行依赖。",
        "",
        "目标是让使用者明确区分：",
        "",
        "- 哪些只是指导型 skill",
        "- 哪些缺运行时就真的不能执行",
        "- 当前机器上哪些运行时已经就绪，哪些仍需安装",
        "",
        f"- 项目根目录：`{PROJECT_ROOT}`",
        f"- 当前检测统计：已就绪 `{ready_count}` / 缺失 `{missing_count}` / 需人工配置 `{manual_count}`",
        "",
        "## 判读规则",
        "",
        "- `ready`：当前机器已满足最基本运行条件",
        "- `missing`：缺失关键命令、模块、认证文件或环境变量",
        "- `manual`：这类依赖需要结合具体外部服务或项目栈人工配置，无法统一自动安装",
        "",
    ]

    for category, title in [
        ("tool", "Tools 运行时"),
        ("mcp", "MCP 运行时"),
        ("skill", "Skills 运行时"),
        ("shared", "共享基础运行时"),
    ]:
        lines.append(f"## {title}")
        lines.append("")
        for check in [item for item in checks if item.requirement.category == category]:
            requirement = check.requirement
            lines.append(f"### {requirement.label}")
            lines.append("")
            lines.append(f"- 状态：`{check.status}`")
            lines.append(f"- 类型：`{requirement.requirement_type}`")
            lines.append(f"- 说明：{requirement.summary}")
            lines.append(f"- 安装：{requirement.install_hint}")
            lines.append(f"- 当前检测：{check.detail}")
            if requirement.required_by:
                lines.append("- 影响范围：")
                for item in requirement.required_by:
                    lines.append(f"  - `{item}`")
            if requirement.notes:
                lines.append("- 备注：")
                for note in requirement.notes:
                    lines.append(f"  - {note}")
            lines.append("")

    lines.append("## 结论")
    lines.append("")
    lines.append("- 项目自己的 `skills/` 是统一运行时入口。")
    lines.append("- vendored 第三方 skill 只有在对应运行时已安装后，才具备真正执行能力。")
    lines.append("- 对于指导型 skill，应把它理解为高质量工程指南，而不是即装即用的 CLI。")
    lines.append("")
    return "\n".join(lines)
