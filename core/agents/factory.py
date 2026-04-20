from __future__ import annotations

import asyncio
import json
import os
from typing import Any, Callable

from motus.agent import ReActAgent
from motus.models.base import ReasoningConfig
from motus.tools import builtin_tools, get_mcp, tool, tools
from motus.tools.builtins.ask_user import ask_user_question
from motus.tools.builtins._helpers import BASH_MAX_TIMEOUT_MS, truncate_output
from motus.tools.builtins.bash import BashInput
from motus.tools.builtins.to_do import TodoInput

from core.agents.multi_agent import MultiAgentUsageTracker, TrackedAgentTool
from core.config.env import load_project_env
from core.config.paths import SKILLS_DIR
from core.guardrails.factory import build_agent_guardrails, build_tool_guardrails, make_tool_path_guardrail
from core.llm.client_factory import create_chat_client
from core.llm.response_formats import build_response_format_model
from core.sandbox.factory import SandboxRuntime, build_sandbox_runtime
from core.schemas.guardrails import GuardrailRule, ToolGuardrailConfig
from core.schemas.mcp import McpServerConfig
from core.schemas.model_client import ModelClientConfig
from core.schemas.multi_agent import MultiAgentConfig, OutputExtractorConfig, SpecialistAgentConfig
from core.schemas.response_format import ResponseFormatConfig
from core.schemas.sandbox import SandboxConfig
from core.schemas.thinking import ThinkingConfig
from core.schemas.tool_host import ToolCatalogResponse, ToolDescriptor
from core.tools.host import ToolBuildContext, build_dynamic_tool_map, get_tool_catalog
from tools.integrations.firecrawl.firecrawl_tools import web_interact, web_scrape, web_search
from tools.integrations.officecli.office_tools import office_cli


load_project_env()

DEFAULT_OPERATION_TIMEOUT_SECONDS = 600.0
DEFAULT_BASH_TIMEOUT_MS = 600_000

BUSINESS_TOOL_NAMES = [
    "web_search",
    "web_scrape",
    "web_interact",
    "office_cli",
]

SYSTEM_TOOL_NAMES = [
    "bash",
    "read_file",
    "write_file",
    "edit_file",
    "glob_search",
    "grep_search",
    "to_do",
]

HITL_TOOL_NAMES = [
    "ask_user_question",
]

SKILL_TOOL_NAMES = [
    "load_skill",
]

ALL_TOOL_NAMES = [*BUSINESS_TOOL_NAMES, *SYSTEM_TOOL_NAMES, *SKILL_TOOL_NAMES]
ALL_HITL_TOOL_NAMES = [*ALL_TOOL_NAMES, *HITL_TOOL_NAMES]

TOOL_LABELS = {
    "web_search": "网页搜索",
    "web_scrape": "网页抓取",
    "web_interact": "网页交互",
    "office_cli": "Office CLI",
    "bash": "bash",
    "read_file": "read_file",
    "write_file": "write_file",
    "edit_file": "edit_file",
    "glob_search": "glob_search",
    "grep_search": "grep_search",
    "to_do": "to_do",
    "load_skill": "load_skill",
    "ask_user_question": "ask_user_question",
}

TOOL_GROUPS = {
    "web_search": "business",
    "web_scrape": "business",
    "web_interact": "business",
    "office_cli": "business",
    "bash": "system",
    "read_file": "system",
    "write_file": "system",
    "edit_file": "system",
    "glob_search": "system",
    "grep_search": "system",
    "to_do": "system",
    "load_skill": "skill",
    "ask_user_question": "hitl",
}


def build_system_prompt(
    base_prompt: str,
    enabled_tools: list[str],
    *,
    human_in_the_loop: bool = False,
    has_specialists: bool = False,
) -> str:
    """根据启用工具补充关键使用约束。"""

    guidance: list[str] = []
    if any(tool_name in enabled_tools for tool_name in ["read_file", "write_file", "edit_file"]):
        guidance.append(
            "进行文件读写和编辑时，优先使用 read_file、write_file、edit_file，不要用 bash 代替普通文件操作。"
        )
        guidance.append("使用 read_file、write_file、edit_file 时，文件路径必须使用绝对路径。")
    if "glob_search" in enabled_tools or "grep_search" in enabled_tools:
        guidance.append("按文件名查找优先用 glob_search，按内容查找优先用 grep_search。")
    if "bash" in enabled_tools:
        guidance.append("bash 仅用于 shell 命令，不要用 bash 承担常规文件读写。")
        guidance.append(
            "当需要做数据清洗、聚合或统计时，可通过 bash 调用 Python 完成分析；但最终回答中的内嵌图示应优先输出 Mermaid 或 viz 代码块，而不是直接给 Python 绘图库源码。"
        )
    if "to_do" in enabled_tools:
        guidance.append("当任务较长或包含多个步骤时，使用 to_do 跟踪当前进度。")
    guidance.append(
        "当前会话支持内嵌 Mermaid 与 viz 代码块：Mermaid 适合流程、结构、状态、时序、架构、算法分块；viz 适合 line、bar、area、pie、doughnut、scatter、radar、heatmap、funnel、gauge、sankey、candlestick 图表。"
    )
    guidance.append(
        "viz 最小合法结构：折线/柱状/面积图使用 {type, x, series:[{name, data}]}; 饼图/环形图使用 {type, series:[{data:[{name, value}]}]}; scatter 使用 {type, series:[{name, points:[{x, y}]}]}；heatmap 使用 {type, x, y, values:[[xIndex, yIndex, value]]}，且必须是合法 JSON。"
    )
    if "load_skill" in enabled_tools:
        guidance.append("当请求明显属于某个已知 skill 时，先调用 load_skill 获取流程和参考文档。")
        guidance.append(
            "当请求涉及数据分析图表、流程图、架构关系、排查路径、对比说明等可视化表达时，优先调用 load_skill 加载 inline_visualization。"
        )
    if has_specialists:
        guidance.append("当某个子代理的 description 明显更匹配当前子任务时，优先委派给对应子代理，而不是自己硬做。")
    if human_in_the_loop and "ask_user_question" in enabled_tools:
        guidance.append("当需求存在歧义、需要用户决策或需要确认危险操作时，调用 ask_user_question。")

    if not guidance:
        return base_prompt

    return f"{base_prompt}\n\n工具使用约束：\n- " + "\n- ".join(guidance)


def make_session_todo_tool():
    """构造会话隔离版 to_do。

    当前本地 ChatService 是单进程多 session，内置 to_do 的模块级全局列表会串状态，
    所以本地会话模式必须用这一层隔离。
    """

    items: list[dict[str, Any]] = []

    @tool(name="to_do", schema=TodoInput)
    async def session_to_do(todos: list) -> list[dict]:
        """维护当前会话的待办列表，用于多步骤任务跟踪。"""

        items.clear()
        for todo in todos:
            items.append(
                {
                    "content": todo["content"],
                    "status": todo["status"],
                    "activeForm": todo.get("activeForm"),
                }
            )
        return list(items)

    return session_to_do


def make_project_bash_tool(sandbox: Any):
    """构造项目自定义 bash 工具。

    Motus 内置 bash 默认 120 秒，这里统一提升到 600 秒，并保持 600 秒上限。
    """

    @tool(name="bash", schema=BashInput)
    async def project_bash(command: str, timeout: float | None = None, **_kwargs) -> str:
        timeout_ms = timeout or DEFAULT_BASH_TIMEOUT_MS
        timeout_ms = min(timeout_ms, BASH_MAX_TIMEOUT_MS)
        timeout_s = timeout_ms / 1000.0

        try:
            result = await asyncio.wait_for(
                sandbox.sh(command),
                timeout=timeout_s,
            )
        except asyncio.TimeoutError:
            return (
                f"Error: Command timed out after {timeout_s:.0f} seconds. "
                "Consider splitting the command or increasing the explicit timeout parameter."
            )

        return truncate_output(result)

    return project_bash


def _read_existing_tool_guardrails(tool_obj: Any) -> tuple[list[Callable], list[Callable]]:
    """读取工具对象或函数上已经存在的 guardrail。"""

    if hasattr(tool_obj, "_input_guardrails"):
        return (
            list(getattr(tool_obj, "_input_guardrails", []) or []),
            list(getattr(tool_obj, "_output_guardrails", []) or []),
        )

    return (
        list(getattr(tool_obj, "__tool_input_guardrails__", []) or []),
        list(getattr(tool_obj, "__tool_output_guardrails__", []) or []),
    )


def _patch_tool_runtime(
    tool_obj: Any,
    *,
    input_guardrails: list[Callable] | None = None,
    output_guardrails: list[Callable] | None = None,
    requires_approval: bool = False,
) -> Any:
    """把 guardrail / approval 配置补丁到工具实例或工具函数上。"""

    existing_input, existing_output = _read_existing_tool_guardrails(tool_obj)
    merged_input = [*existing_input, *(input_guardrails or [])]
    merged_output = [*existing_output, *(output_guardrails or [])]
    tool(
        tool_obj,
        input_guardrails=merged_input or None,
        output_guardrails=merged_output or None,
        requires_approval=requires_approval,
    )
    return tool_obj


def _build_workspace_tool_guardrails(
    *,
    workspace_root: str,
    restrict_enabled: bool,
) -> dict[str, dict[str, list[Callable]]]:
    """为文件工具补充默认的工作区路径约束。"""

    if not restrict_enabled:
        return {}

    path_guardrail = make_tool_path_guardrail(
        allowed_roots=[workspace_root],
        path_fields=["path"],
        require_absolute_paths=True,
    )
    return {
        "read_file": {"input": [path_guardrail], "output": []},
        "write_file": {"input": [path_guardrail], "output": []},
        "edit_file": {"input": [path_guardrail], "output": []},
    }


def _merge_tool_guardrail_maps(*maps: dict[str, dict[str, list[Callable]]]) -> dict[str, dict[str, list[Callable]]]:
    merged: dict[str, dict[str, list[Callable]]] = {}
    for mapping in maps:
        for tool_name, guards in mapping.items():
            bucket = merged.setdefault(tool_name, {"input": [], "output": []})
            bucket["input"].extend(guards.get("input", []))
            bucket["output"].extend(guards.get("output", []))
    return merged


def create_tool_map(
    *,
    sandbox_runtime: SandboxRuntime | None,
    sandbox_config: SandboxConfig | None,
    session_scoped_todo: bool,
    human_in_the_loop: bool,
    approval_tool_names: set[str] | None = None,
    tool_guardrail_configs: list[ToolGuardrailConfig] | None = None,
) -> dict[str, Any]:
    """创建一套工具实例。

    注意这里每次都重新构造 builtin_tools，避免会话之间共享同一批 Tool 对象。
    """

    runtime = sandbox_runtime or build_sandbox_runtime(sandbox_config)
    sandbox = runtime.sandbox
    builtin = builtin_tools(sandbox=sandbox, skills_dir=SKILLS_DIR)
    tool_map: dict[str, Any] = {
        "web_search": web_search,
        "web_scrape": web_scrape,
        "web_interact": web_interact,
        "office_cli": office_cli,
        "bash": make_project_bash_tool(sandbox),
        "read_file": builtin.read_file,
        "write_file": builtin.write_file,
        "edit_file": builtin.edit_file,
        "glob_search": builtin.glob_search,
        "grep_search": builtin.grep_search,
        "to_do": make_session_todo_tool() if session_scoped_todo else builtin.to_do,
    }
    if builtin.load_skill is not None:
        tool_map["load_skill"] = builtin.load_skill

    if human_in_the_loop:
        tool_map["ask_user_question"] = ask_user_question

    dynamic_tool_map = build_dynamic_tool_map(
        ToolBuildContext(
            sandbox_runtime=runtime,
            sandbox_config=sandbox_config,
            session_scoped_todo=session_scoped_todo,
            human_in_the_loop=human_in_the_loop,
        )
    )
    duplicate_tool_names = set(tool_map) & set(dynamic_tool_map)
    if duplicate_tool_names:
        duplicate_names = ", ".join(sorted(duplicate_tool_names))
        raise ValueError(f"动态工具与内置工具重名: {duplicate_names}")
    tool_map.update(dynamic_tool_map)

    compiled_tool_guardrails = _merge_tool_guardrail_maps(
        _build_workspace_tool_guardrails(
            workspace_root=runtime.workspace_root,
            restrict_enabled=bool((sandbox_config or SandboxConfig()).restrict_file_tools_to_workspace),
        ),
        build_tool_guardrails(tool_guardrail_configs),
    )

    for tool_name, tool_obj in tool_map.items():
        guards = compiled_tool_guardrails.get(tool_name, {})
        requires_approval = tool_name in (approval_tool_names or set())
        _patch_tool_runtime(
            tool_obj,
            input_guardrails=guards.get("input"),
            output_guardrails=guards.get("output"),
            requires_approval=requires_approval,
        )

    return tool_map


def build_output_extractor(config: OutputExtractorConfig | None) -> Callable[[Any], Any] | None:
    """把声明式 output_extractor 配置转成运行时函数。"""

    if config is None or config.mode == "full":
        return None

    if config.mode == "json":
        def _extract_json(result: Any) -> Any:
            if isinstance(result, str):
                try:
                    return json.loads(result)
                except json.JSONDecodeError:
                    return result
            return result

        return _extract_json

    def _extract_field(result: Any) -> Any:
        current = result
        if isinstance(current, str):
            try:
                current = json.loads(current)
            except json.JSONDecodeError:
                return current
        for segment in str(config.field_path or "").split("."):
            if isinstance(current, dict) and segment in current:
                current = current[segment]
                continue
            return result
        return current

    return _extract_field


def get_tool_catalog_response() -> ToolCatalogResponse:
    """返回包含内置工具与动态工具的统一目录。"""

    builtin_descriptors = [
        ToolDescriptor(
            name=name,
            group=TOOL_GROUPS.get(name, "default"),
            label=TOOL_LABELS.get(name),
            source="builtin",
            persistence="memory",
            human_in_the_loop_only=name in HITL_TOOL_NAMES,
        )
        for name in ALL_HITL_TOOL_NAMES
    ]
    dynamic_catalog = get_tool_catalog()
    return ToolCatalogResponse(
        tools=sorted(
            [*builtin_descriptors, *dynamic_catalog.tools],
            key=lambda item: (item.group, item.name),
        )
    )


def create_mcp_sessions(mcp_servers: list[McpServerConfig] | None) -> list[Any]:
    """根据配置构造 MCP session 列表。"""

    sessions: list[Any] = []
    for config in mcp_servers or []:
        if config.transport == "remote_http":
            session = get_mcp(
                url=config.url,
                headers=config.headers or None,
            )
            sessions.append(
                tools(
                    session,
                    prefix=config.prefix,
                    allowlist=set(config.allowlist) if config.allowlist else None,
                    blocklist=set(config.blocklist) if config.blocklist else None,
                    method_aliases=config.method_aliases or None,
                )
            )
        elif config.transport == "local_stdio":
            sandbox = None
            if config.sandbox is not None:
                if config.sandbox.provider == "local":
                    raise ValueError("MCP sandbox 不支持 local provider，请使用 docker 或 cloud")
                sandbox = build_sandbox_runtime(config.sandbox).sandbox
            session = get_mcp(
                command=config.command,
                args=config.args,
                env=config.env or None,
                image=config.image,
                sandbox=sandbox,
                port=config.port,
                sandbox_path=config.sandbox_path,
            )
            sessions.append(
                tools(
                    session,
                    prefix=config.prefix,
                    allowlist=set(config.allowlist) if config.allowlist else None,
                    blocklist=set(config.blocklist) if config.blocklist else None,
                    method_aliases=config.method_aliases or None,
                )
            )
    return sessions


def build_specialist_prompt(config: SpecialistAgentConfig) -> str:
    """为未显式提供 system prompt 的子代理生成聚焦提示。"""

    return (
        f"你是子代理 {config.name}。\n"
        f"你的职责：{config.description}\n"
        "仅处理与你职责直接相关的子问题。\n"
        "如果信息不足，明确说明缺口；如果已经得出结论，返回可直接被上级 agent 复用的简洁结果。"
    )


def resolve_thinking_config(
    *,
    enabled: bool,
    effort: str | None,
    verbosity: str | None,
    budget_tokens: int | None,
    override: ThinkingConfig | None,
) -> ThinkingConfig:
    """把父级 thinking 配置和子代理覆盖项合并成最终配置。"""

    if override is not None:
        return override
    return ThinkingConfig(
        enabled=enabled,
        effort=effort,  # type: ignore[arg-type]
        verbosity=verbosity,  # type: ignore[arg-type]
        budget_tokens=budget_tokens,
    )


def wrap_step_callback(
    step_callback: Callable[[str, str | None, list[dict]], Any] | None,
    agent_name: str | None,
) -> Callable[[str | None, list[dict]], Any] | None:
    """把 Motus 原始 step_callback 包装成带 agent_name 的统一事件接口。"""

    if step_callback is None:
        return None

    resolved_name = agent_name or "assistant"

    async def _wrapped(content: str | None, tool_calls: list[dict]) -> Any:
        return await step_callback(resolved_name, content, tool_calls)

    return _wrapped


def build_specialist_tools(
    *,
    specialists: list[SpecialistAgentConfig],
    parent_provider: str,
    parent_model_name: str,
    parent_cache_policy: str,
    parent_model_client: ModelClientConfig,
    parent_enabled_tools: list[str],
    parent_max_steps: int,
    parent_timeout_seconds: float | None,
    memory_type: str,
    parent_thinking_enabled: bool,
    parent_thinking_effort: str | None,
    parent_thinking_verbosity: str | None,
    parent_thinking_budget_tokens: int | None,
    parent_human_in_the_loop: bool,
    parent_approval_tool_names: set[str] | None,
    parent_mcp_servers: list[McpServerConfig] | None,
    parent_sandbox_config: SandboxConfig | None,
    parent_input_guardrails: list[GuardrailRule] | None,
    parent_output_guardrails: list[GuardrailRule] | None,
    parent_tool_guardrails: list[ToolGuardrailConfig] | None,
    sandbox_runtime: SandboxRuntime | None,
    session_scoped_todo: bool,
    step_callback: Callable[[str, str | None, list[dict]], Any] | None,
    specialist_usage_tracker: MultiAgentUsageTracker | None,
    memory_factory: Callable[[str], Any] | None,
    parent_agent_path: str,
) -> list[Any]:
    """递归构造子代理工具树。"""

    tools: list[Any] = []
    tool_names: set[str] = set()
    tracker = specialist_usage_tracker or MultiAgentUsageTracker()

    for specialist in specialists:
        tool_name = specialist.tool_name or specialist.name
        if tool_name in tool_names:
            raise ValueError(f"重复的子代理工具名: {tool_name}")
        tool_names.add(tool_name)

        child_thinking = resolve_thinking_config(
            enabled=parent_thinking_enabled,
            effort=parent_thinking_effort,
            verbosity=parent_thinking_verbosity,
            budget_tokens=parent_thinking_budget_tokens,
            override=specialist.thinking,
        )
        child_path = f"{parent_agent_path}/{specialist.name}"
        child_memory = memory_factory(child_path) if memory_factory is not None else None
        child_multi_agent = MultiAgentConfig(
            supervisor_name=specialist.name,
            specialists=specialist.specialists,
        )

        child_agent = create_react_agent(
            agent_name=specialist.name,
            system_prompt=specialist.system_prompt or build_specialist_prompt(specialist),
            provider=specialist.provider or parent_provider,
            model_name=specialist.model_name or parent_model_name,
            cache_policy=parent_cache_policy,
            model_client=parent_model_client,
            enabled_tools=list(
                specialist.enabled_tools
                if specialist.enabled_tools is not None
                else parent_enabled_tools
            ),
            max_steps=specialist.max_steps or parent_max_steps,
            timeout_seconds=(
                specialist.timeout_seconds
                if specialist.timeout_seconds is not None
                else parent_timeout_seconds
            ),
            memory_type=memory_type,
            thinking_enabled=child_thinking.enabled,
            thinking_effort=child_thinking.effort,
            thinking_verbosity=child_thinking.verbosity,
            thinking_budget_tokens=child_thinking.budget_tokens,
            memory=child_memory,
            step_callback=step_callback,
            session_scoped_todo=session_scoped_todo,
            human_in_the_loop=parent_human_in_the_loop,
            approval_tool_names=parent_approval_tool_names,
            mcp_servers=(
                specialist.mcp_servers
                if specialist.mcp_servers is not None
                else parent_mcp_servers
            ),
            sandbox_config=parent_sandbox_config,
            input_guardrails=parent_input_guardrails,
            output_guardrails=parent_output_guardrails,
            tool_guardrails=parent_tool_guardrails,
            response_format_config=None,
            sandbox_runtime=sandbox_runtime,
            multi_agent=child_multi_agent,
            specialist_usage_tracker=tracker,
            memory_factory=memory_factory,
            agent_path=child_path,
        )

        tools.append(
            TrackedAgentTool(
                child_agent,
                tracker=tracker,
                agent_name=specialist.name,
                model_name=specialist.model_name or parent_model_name,
                pricing_model=specialist.pricing_model,
                name=tool_name,
                description=specialist.description,
                output_extractor=build_output_extractor(specialist.output_extractor),
                stateful=specialist.stateful,
                max_steps=specialist.tool_max_steps,
            )
        )

    return tools


def create_react_agent(
    *,
    agent_name: str | None = None,
    system_prompt: str,
    provider: str,
    model_name: str,
    cache_policy: str = "auto",
    model_client: ModelClientConfig | None = None,
    enabled_tools: list[str],
    max_steps: int,
    timeout_seconds: float | None,
    memory_type: str = "compact",
    thinking_enabled: bool,
    thinking_effort: str | None,
    thinking_verbosity: str | None,
    thinking_budget_tokens: int | None = None,
    memory: Any,
    step_callback: Callable[[str, str | None, list[dict]], Any] | None = None,
    session_scoped_todo: bool = True,
    human_in_the_loop: bool = False,
    approval_tool_names: set[str] | None = None,
    mcp_servers: list[McpServerConfig] | None = None,
    sandbox_config: SandboxConfig | None = None,
    input_guardrails: list[GuardrailRule] | None = None,
    output_guardrails: list[GuardrailRule] | None = None,
    tool_guardrails: list[ToolGuardrailConfig] | None = None,
    response_format_config: ResponseFormatConfig | None = None,
    sandbox_runtime: SandboxRuntime | None = None,
    multi_agent: MultiAgentConfig | None = None,
    specialist_usage_tracker: MultiAgentUsageTracker | None = None,
    memory_factory: Callable[[str], Any] | None = None,
    agent_path: str | None = None,
) -> ReActAgent:
    """统一构造 ReActAgent。"""

    runtime = sandbox_runtime or build_sandbox_runtime(sandbox_config)
    tool_map = create_tool_map(
        sandbox_runtime=runtime,
        sandbox_config=sandbox_config,
        session_scoped_todo=session_scoped_todo,
        human_in_the_loop=human_in_the_loop,
        approval_tool_names=approval_tool_names,
        tool_guardrail_configs=tool_guardrails,
    )
    missing_tool_names = [name for name in enabled_tools if name not in tool_map]
    if missing_tool_names:
        raise ValueError(f"未知工具: {', '.join(sorted(missing_tool_names))}")

    tools = [tool_map[name] for name in enabled_tools]
    tools.extend(create_mcp_sessions(mcp_servers))
    if multi_agent and multi_agent.specialists:
        tools.extend(
            build_specialist_tools(
                specialists=multi_agent.specialists,
                parent_provider=provider,
                parent_model_name=model_name,
                parent_cache_policy=cache_policy,
                parent_model_client=model_client or ModelClientConfig(),
                parent_enabled_tools=enabled_tools,
                parent_max_steps=max_steps,
                parent_timeout_seconds=timeout_seconds,
                memory_type=memory_type,
                parent_thinking_enabled=thinking_enabled,
                parent_thinking_effort=thinking_effort,
                parent_thinking_verbosity=thinking_verbosity,
                parent_thinking_budget_tokens=thinking_budget_tokens,
                parent_human_in_the_loop=human_in_the_loop,
                parent_approval_tool_names=approval_tool_names,
                parent_mcp_servers=mcp_servers,
                parent_sandbox_config=sandbox_config,
                parent_input_guardrails=input_guardrails,
                parent_output_guardrails=output_guardrails,
                parent_tool_guardrails=tool_guardrails,
                sandbox_runtime=runtime,
                session_scoped_todo=session_scoped_todo,
                step_callback=step_callback,
                specialist_usage_tracker=specialist_usage_tracker,
                memory_factory=memory_factory,
                parent_agent_path=agent_path or (agent_name or "assistant"),
            )
        )

    client = create_chat_client(
        provider=provider,  # type: ignore[arg-type]
        default_verbosity=thinking_verbosity,
        default_reasoning_effort=thinking_effort or "medium",
        model_client=model_client,
    )
    response_format_model = build_response_format_model(response_format_config)

    return ReActAgent(
        client=client,
        model_name=model_name,
        name=agent_name,
        system_prompt=build_system_prompt(
            system_prompt,
            enabled_tools,
            human_in_the_loop=human_in_the_loop,
            has_specialists=bool(multi_agent and multi_agent.specialists),
        ),
        tools=tools,
        response_format=response_format_model,
        memory=memory,
        max_steps=max_steps,
        timeout=timeout_seconds,
        memory_type=memory_type,
        input_guardrails=build_agent_guardrails(input_guardrails, direction="input"),
        output_guardrails=build_agent_guardrails(output_guardrails, direction="output"),
        reasoning=ReasoningConfig(
            enabled=thinking_enabled,
            effort=thinking_effort,
            budget_tokens=thinking_budget_tokens,
        ),
        cache_policy=cache_policy,
        step_callback=wrap_step_callback(step_callback, agent_name),
    )
