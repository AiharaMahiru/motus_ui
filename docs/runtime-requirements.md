# 运行时依赖说明

这份文档用于说明当前项目中 `skills / tools / mcp` 的可执行依赖。

目标是让使用者明确区分：

- 哪些只是指导型 skill
- 哪些缺运行时就真的不能执行
- 当前机器上哪些运行时已经就绪，哪些仍需安装

- 项目根目录：`/opt/Agent`
- 当前检测统计：已就绪 `8` / 缺失 `10` / 需人工配置 `3`

## 判读规则

- `ready`：当前机器已满足最基本运行条件
- `missing`：缺失关键命令、模块、认证文件或环境变量
- `manual`：这类依赖需要结合具体外部服务或项目栈人工配置，无法统一自动安装

## Tools 运行时

### FIRECRAWL_KEY

- 状态：`ready`
- 类型：`env`
- 说明：网页搜索/抓取/交互工具的鉴权凭据。
- 安装：在项目根目录 `.env` 中配置 `FIRECRAWL_KEY=...`。
- 当前检测：已满足当前检测条件。
- 影响范围：
  - `web_search`
  - `web_scrape`
  - `web_interact`
  - `web_research`

### officecli CLI

- 状态：`ready`
- 类型：`binary`
- 说明：Office 文档读写执行引擎，缺失时 `office_cli` 和 `office_documents` 无法真正操作文件。
- 安装：按 `tools/integrations/officecli/SKILL.md` 安装 `officecli` 并确认 `officecli --version` 可用。
- 当前检测：officecli=/root/.local/bin/officecli
- 影响范围：
  - `office_cli`
  - `office_documents`

## MCP 运行时

### Remote HTTP MCP 服务

- 状态：`manual`
- 类型：`service`
- 说明：`remote_http` 模式要求远端 MCP 服务可达。
- 安装：准备可访问的 MCP URL，并通过 `SessionCreateRequest.mcp_servers` 提供 `url` 与必要的 headers。
- 当前检测：该项依赖需要用户按项目场景自行配置，当前仅做文档提醒。
- 影响范围：
  - `MCP remote_http`
- 备注：
  - 这是外部服务依赖，项目无法在本地自动安装。

### Local stdio MCP 命令

- 状态：`manual`
- 类型：`binary`
- 说明：`local_stdio` 模式要求指定命令存在于本机 PATH，或能通过绝对路径启动。
- 安装：例如配置 `npx @playwright/mcp`，并先确认 `npx` 或目标命令可以在终端启动。
- 当前检测：该项依赖需要用户按项目场景自行配置，当前仅做文档提醒。
- 影响范围：
  - `MCP local_stdio`
- 备注：
  - 这是按具体 MCP server 配置动态决定的，TUI 只能做通用提醒。

## Skills 运行时

### Node.js / npm

- 状态：`ready`
- 类型：`binary`
- 说明：多项第三方前端/多媒体 skill 依赖 Node.js 生态安装 CLI 或包。
- 安装：安装 Node.js LTS，并确认 `node -v`、`npm -v` 可用。
- 当前检测：node=/www/server/nodejs/v24.11.1/bin/node；npm=/www/server/nodejs/v24.11.1/bin/npm
- 影响范围：
  - `frontend-dev`
  - `react-native-dev`
  - `pptx-generator`
  - `buddy-sings`
  - `mmx-cli`
  - `minimax-music-gen`
  - `minimax-music-playlist`

### mmx CLI 已安装并认证

- 状态：`missing`
- 类型：`file`
- 说明：MiniMax 多模态 skill 的实际执行入口，需先安装 CLI 并完成认证。
- 安装：执行 `npm install -g mmx-cli`，然后运行 `mmx auth login --api-key <your-key>`。
- 当前检测：缺失：命令 mmx、文件 /root/.mmx/credentials.json
- 影响范围：
  - `mmx-cli`
  - `buddy-sings`
  - `minimax-music-gen`
  - `minimax-music-playlist`

### MINIMAX_API_KEY / MiniMax Token Plan

- 状态：`missing`
- 类型：`env`
- 说明：部分 MiniMax skill 直接依赖 API Key 或 Token Plan 权限。
- 安装：在对应环境中配置 `MINIMAX_API_KEY`，并确认账号具备所需套餐或视觉 Token Plan 权限。
- 当前检测：缺失：环境变量 MINIMAX_API_KEY
- 影响范围：
  - `vision-analysis`
  - `gif-sticker-maker`
  - `frontend-dev(生成媒体资产)`
- 备注：
  - `vision-analysis` 额外要求 MiniMax Token Plan，不是普通 API key 即可替代。

### FFmpeg

- 状态：`ready`
- 类型：`binary`
- 说明：多媒体处理、GIF 转换、音视频后处理依赖 FFmpeg。
- 安装：安装 FFmpeg，并确认 `ffmpeg -version` 可用。
- 当前检测：ffmpeg=/usr/bin/ffmpeg
- 影响范围：
  - `gif-sticker-maker`
  - `mmx-cli(媒体处理)`
  - `frontend-dev(生成媒体后处理)`

### .NET SDK 8+

- 状态：`missing`
- 类型：`binary`
- 说明：`minimax-docx` 的 OpenXML CLI 与 C# 脚本运行时。
- 安装：安装 .NET SDK 8+，并确认 `dotnet --version` >= 8。
- 当前检测：缺失：命令 dotnet
- 影响范围：
  - `minimax-docx`

### markitdown Python 模块

- 状态：`missing`
- 类型：`module`
- 说明：`pptx-generator` 读取/分析 PPTX 时依赖 markitdown。
- 安装：执行 `pip install "markitdown[pptx]"`。
- 当前检测：缺失：Python 模块 markitdown
- 影响范围：
  - `pptx-generator`

### PptxGenJS / Node 包

- 状态：`ready`
- 类型：`stack`
- 说明：`pptx-generator` 从零创建 PPTX 时依赖 Node.js 与 PptxGenJS。
- 安装：先安装 Node.js，再执行 `npm install -g pptxgenjs`；如需图标和图片处理，再安装 `react-icons react react-dom sharp`。
- 当前检测：node=/www/server/nodejs/v24.11.1/bin/node；npm=/www/server/nodejs/v24.11.1/bin/npm
- 影响范围：
  - `pptx-generator`
- 备注：
  - 当前仅能检测 Node/npm 是否存在，PptxGenJS 包本身需按 skill 文档安装。

### pandas Python 模块

- 状态：`missing`
- 类型：`module`
- 说明：`minimax-xlsx` 读取和分析电子表格时依赖 pandas。
- 安装：执行 `pip install pandas`。
- 当前检测：缺失：Python 模块 pandas
- 影响范围：
  - `minimax-xlsx`

### LibreOffice / soffice

- 状态：`missing`
- 类型：`binary`
- 说明：`minimax-xlsx` 做公式重算与验证时的可选增强运行时。
- 安装：安装 LibreOffice，并确认 `libreoffice` 或 `soffice` 可用。
- 当前检测：缺失：命令 libreoffice、命令 soffice
- 影响范围：
  - `minimax-xlsx(动态重算/验证)`
- 备注：
  - 这是增强能力，不装也能做部分 XML 级编辑。

### Playwright + Chromium

- 状态：`ready`
- 类型：`stack`
- 说明：`minimax-pdf` 的部分封面渲染链路依赖 Playwright 与 Chromium。
- 安装：执行 `npm install -g playwright && npx playwright install chromium`。
- 当前检测：npx=/www/server/nodejs/v24.11.1/bin/npx
- 影响范围：
  - `minimax-pdf`
- 备注：
  - 当前只检测 `npx`；浏览器下载需按 skill 文档单独执行。

### reportlab / pypdf

- 状态：`missing`
- 类型：`module`
- 说明：`minimax-pdf` 的 PDF 生成、填充、合并链路依赖 Python 包。
- 安装：执行 `pip install reportlab pypdf`。
- 当前检测：缺失：Python 模块 reportlab、Python 模块 pypdf
- 影响范围：
  - `minimax-pdf`

### Flutter SDK

- 状态：`missing`
- 类型：`binary`
- 说明：`flutter-dev` 属于执行型开发技能，实际构建、运行、分析依赖 Flutter SDK。
- 安装：安装 Flutter SDK，并确认 `flutter doctor` 可运行。
- 当前检测：缺失：命令 flutter
- 影响范围：
  - `flutter-dev`

### Android SDK / Gradle / JDK

- 状态：`missing`
- 类型：`stack`
- 说明：`android-native-dev` 的构建、安装和调试链路依赖 Android 工具链。
- 安装：安装 Android Studio 或独立 Android SDK、JDK，并确保 `./gradlew` 或 `gradle` 可用。
- 当前检测：缺失：命令 gradle
- 影响范围：
  - `android-native-dev`
- 备注：
  - 项目级 Android 工程通常还需要 `gradlew` 包装脚本。

### Xcode / xcodebuild

- 状态：`missing`
- 类型：`binary`
- 说明：`ios-application-dev` 的真实构建、签名、模拟器调试依赖 Xcode。
- 安装：在 macOS 安装 Xcode，并确认 `xcodebuild -version` 可用。
- 当前检测：缺失：命令 xcodebuild
- 影响范围：
  - `ios-application-dev`

### Expo / React Native Node 工具链

- 状态：`ready`
- 类型：`stack`
- 说明：`react-native-dev` 的开发、调试、依赖安装依赖 Node.js 与 Expo 工具链。
- 安装：安装 Node.js，并按项目执行 `npx expo install ...` 或对应依赖安装命令。
- 当前检测：node=/www/server/nodejs/v24.11.1/bin/node；npm=/www/server/nodejs/v24.11.1/bin/npm；npx=/www/server/nodejs/v24.11.1/bin/npx
- 影响范围：
  - `react-native-dev`

### 指导型技能（无统一硬运行时）

- 状态：`manual`
- 类型：`service`
- 说明：部分 skill 主要提供工程指导，本身没有统一的硬运行时门槛，但实际项目仍取决于目标技术栈。
- 安装：按具体项目技术栈准备运行时；这些 skill 更像高质量开发手册而不是即插即用 CLI。
- 当前检测：该项依赖需要用户按项目场景自行配置，当前仅做文档提醒。
- 影响范围：
  - `fullstack-dev`
  - `shader-dev`
- 备注：
  - 这类 skill 不应被误认为“安装后就能直接执行”。

## 共享基础运行时

### Python 3 / uv

- 状态：`ready`
- 类型：`stack`
- 说明：当前 agent 项目自己的核心运行时，项目脚本、skill_creator 和多数自动化流程依赖它。
- 安装：安装 Python 3.14 与 uv，并确保 `uv run ...` 可用。
- 当前检测：uv=/root/.local/bin/uv
- 影响范围：
  - `项目主服务`
  - `skill_creator`
  - `smoke scripts`

## 结论

- 项目自己的 `skills/` 是统一运行时入口。
- vendored 第三方 skill 只有在对应运行时已安装后，才具备真正执行能力。
- 对于指导型 skill，应把它理解为高质量工程指南，而不是即装即用的 CLI。
