# Runtime Requirements

This document explains the executable dependencies behind `skills / tools / MCP` in the current project.

The goal is to make the following distinctions explicit:

- which items are guidance-only skills
- which items are truly blocked without a runtime dependency
- which runtimes are already present on the current machine and which still need installation

- project root: `/opt/Agent`
- current scan summary: `8 ready / 10 missing / 3 manual`

## Status Rules

- `ready`: the machine satisfies the minimum runtime requirements
- `missing`: a required command, module, credential file, or environment variable is missing
- `manual`: the dependency must be configured manually based on the target service or project environment

## Tool Runtime Requirements

### FIRECRAWL_KEY

- Status: `ready`
- Type: `env`
- Purpose: authentication for the web search / scrape / interaction tools.
- Setup: define `FIRECRAWL_KEY=...` in the project root `.env`.
- Current detection: satisfied.
- Affected features:
  - `web_search`
  - `web_scrape`
  - `web_interact`
  - `web_research`

### officecli CLI

- Status: `ready`
- Type: `binary`
- Purpose: execution engine for Office document read/write operations. Without it, `office_cli` and `office_documents` cannot manipulate files for real.
- Setup: install `officecli` according to `tools/integrations/officecli/SKILL.md` and verify `officecli --version`.
- Current detection: `officecli=/root/.local/bin/officecli`
- Affected features:
  - `office_cli`
  - `office_documents`

## MCP Runtime Requirements

### Remote HTTP MCP Service

- Status: `manual`
- Type: `service`
- Purpose: `remote_http` mode requires an accessible remote MCP endpoint.
- Setup: provide a reachable MCP URL through `SessionCreateRequest.mcp_servers` together with any required headers.
- Current detection: documented reminder only; cannot be auto-installed by the project.
- Affected features:
  - `MCP remote_http`

### Local stdio MCP Command

- Status: `manual`
- Type: `binary`
- Purpose: `local_stdio` mode requires the target command to exist on the machine PATH or be callable through an absolute path.
- Setup: for example configure `npx @playwright/mcp` and verify that `npx` or the chosen command can start successfully.
- Current detection: documented reminder only; depends on the actual MCP server selection.
- Affected features:
  - `MCP local_stdio`

## Skill Runtime Requirements

### Node.js / npm

- Status: `ready`
- Type: `binary`
- Purpose: multiple third-party frontend and multimedia skills depend on the Node.js ecosystem.
- Setup: install a Node.js LTS release and verify `node -v` and `npm -v`.
- Current detection: `node=/www/server/nodejs/v24.11.1/bin/node`; `npm=/www/server/nodejs/v24.11.1/bin/npm`
- Affected features:
  - `frontend-dev`
  - `react-native-dev`
  - `pptx-generator`
  - `buddy-sings`
  - `mmx-cli`
  - `minimax-music-gen`
  - `minimax-music-playlist`

### mmx CLI Installed and Authenticated

- Status: `missing`
- Type: `file`
- Purpose: execution entrypoint for MiniMax multimodal skills.
- Setup: run `npm install -g mmx-cli`, then `mmx auth login --api-key <your-key>`.
- Current detection: missing command `mmx` and file `/root/.mmx/credentials.json`.
- Affected features:
  - `mmx-cli`
  - `buddy-sings`
  - `minimax-music-gen`
  - `minimax-music-playlist`

### MINIMAX_API_KEY / MiniMax Token Plan

- Status: `missing`
- Type: `env`
- Purpose: some MiniMax skills depend directly on API keys or Token Plan privileges.
- Setup: define `MINIMAX_API_KEY` and ensure the account has the required plan or vision access.
- Current detection: missing environment variable `MINIMAX_API_KEY`.
- Affected features:
  - `vision-analysis`
  - `gif-sticker-maker`
  - `frontend-dev` media generation flows
- Notes:
  - `vision-analysis` additionally requires the MiniMax Token Plan rather than only a generic API key.

### FFmpeg

- Status: `ready`
- Type: `binary`
- Purpose: required for media processing, GIF conversion, and audio/video post-processing.
- Setup: install FFmpeg and verify `ffmpeg -version`.
- Current detection: `ffmpeg=/usr/bin/ffmpeg`
- Affected features:
  - `gif-sticker-maker`
  - `mmx-cli` media processing
  - `frontend-dev` media post-processing

### .NET SDK 8+

- Status: `missing`
- Type: `binary`
- Purpose: runtime for `minimax-docx` OpenXML tooling and C# helpers.
- Setup: install .NET SDK 8+ and verify `dotnet --version` >= 8.
- Current detection: missing command `dotnet`.
- Affected features:
  - `minimax-docx`

### markitdown Python Module

- Status: `missing`
- Type: `module`
- Purpose: required when `pptx-generator` reads or analyzes PPTX files.
- Setup: run `pip install "markitdown[pptx]"`.
- Current detection: missing Python module `markitdown`.
- Affected features:
  - `pptx-generator`

### PptxGenJS / Node Package

- Status: `ready`
- Type: `stack`
- Purpose: required when `pptx-generator` creates PPTX files from scratch.
- Setup: install Node.js, then `npm install -g pptxgenjs`; optionally add `react-icons react react-dom sharp` for richer asset handling.
- Current detection: Node and npm are available.
- Affected features:
  - `pptx-generator`
- Notes:
  - this check only verifies Node/npm presence, not the global package itself.

### pandas Python Module

- Status: `missing`
- Type: `module`
- Purpose: required when `minimax-xlsx` reads and analyzes spreadsheet content.
- Setup: run `pip install pandas`.
- Current detection: missing Python module `pandas`.
- Affected features:
  - `minimax-xlsx`

### LibreOffice / soffice

- Status: `missing`
- Type: `binary`
- Purpose: optional runtime enhancement for formula recalculation and spreadsheet verification in `minimax-xlsx`.
- Setup: install LibreOffice and verify `libreoffice` or `soffice`.
- Current detection: missing commands `libreoffice` and `soffice`.
- Affected features:
  - `minimax-xlsx` dynamic recalculation / verification
- Notes:
  - this is an enhancement dependency, not a hard blocker for all XML-level editing.

### Playwright + Chromium

- Status: `ready`
- Type: `stack`
- Purpose: some rendering flows in `minimax-pdf` depend on Playwright and Chromium.
- Setup: run `npm install -g playwright && npx playwright install chromium`.
- Current detection: `npx=/www/server/nodejs/v24.11.1/bin/npx`
- Affected features:
  - `minimax-pdf`
- Notes:
  - current detection only confirms `npx`; browser installation still needs to be performed explicitly.

### reportlab / pypdf

- Status: `missing`
- Type: `module`
- Purpose: required for PDF generation, filling, and merge flows in `minimax-pdf`.
- Setup: run `pip install reportlab pypdf`.
- Current detection: missing Python modules `reportlab` and `pypdf`.
- Affected features:
  - `minimax-pdf`

### Flutter SDK

- Status: `missing`
- Type: `binary`
- Purpose: `flutter-dev` is an execution-oriented skill and requires a real Flutter toolchain for build, run, and analysis workflows.
- Setup: install Flutter SDK and verify `flutter doctor`.
- Current detection: missing command `flutter`.
- Affected features:
  - `flutter-dev`

### Android SDK / Gradle / JDK

- Status: `missing`
- Type: `stack`
- Purpose: `android-native-dev` requires the Android build toolchain for compilation, installation, and debugging.
- Setup: install Android Studio or a standalone Android SDK plus JDK, and make sure `./gradlew` or `gradle` is usable.
- Current detection: toolchain not found in a project-scoped way.
- Affected features:
  - `android-native-dev`
