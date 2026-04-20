from __future__ import annotations

from dataclasses import dataclass
import importlib
import importlib.util
from pathlib import Path
from typing import Any, Callable, Type

from pydantic import BaseModel, Field

from motus.runtime import agent_task, resolve

from core.config.paths import WORKFLOW_PLUGINS_DIR
from core.schemas.workflow import WorkflowDefinitionSummary
from core.schemas.workflow_host import WorkflowCatalogResponse, WorkflowHostDescriptor


@dataclass
class WorkflowDefinition:
    name: str
    description: str
    input_model: Type[BaseModel]
    runner: Callable[[BaseModel], dict[str, Any]]
    source: str = "builtin"
    persistence: str = "memory"


_RUNTIME_WORKFLOW_REGISTRY: dict[str, WorkflowDefinition] = {}


class TextInsightsInput(BaseModel):
    text: str = Field(..., description="待分析的文本内容")


class SkillBlueprintInput(BaseModel):
    skill_name: str = Field(..., description="技能名称，建议使用 snake_case")
    purpose: str = Field(..., description="这个 skill 解决什么问题")
    triggers: list[str] = Field(default_factory=list, description="典型触发词或触发场景")
    tools: list[str] = Field(default_factory=list, description="预计依赖的工具列表")
    constraints: list[str] = Field(default_factory=list, description="关键约束或注意事项")


@agent_task(timeout=5, retries=1, retry_delay=0.1)
def normalize_text(text: str) -> str:
    """标准化文本，减少后续步骤重复处理。"""

    return "\n".join(line.rstrip() for line in text.strip().splitlines()).strip()


@agent_task(timeout=5, retries=1, retry_delay=0.1)
def compute_text_stats(text: str) -> dict[str, int]:
    """计算基础统计信息。"""

    lines = [line for line in text.splitlines() if line.strip()]
    words = text.split()
    return {
        "characters": len(text),
        "lines": len(lines),
        "words": len(words),
        "paragraphs": len([part for part in text.split("\n\n") if part.strip()]),
    }


@agent_task(timeout=5, retries=1, retry_delay=0.1)
def extract_headings(text: str) -> list[str]:
    """提取看起来像标题的行。"""

    headings: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith(("#", "##", "###")):
            headings.append(stripped.lstrip("#").strip())
            continue
        if len(stripped) <= 32 and stripped == stripped.strip("：:") and not stripped.endswith(("。", ".", "!", "?")):
            headings.append(stripped)
    return headings[:12]


@agent_task(timeout=5, retries=1, retry_delay=0.1)
def extract_keywords(text: str) -> list[str]:
    """用极简规则抽取高频关键词。"""

    stopwords = {
        "the",
        "and",
        "for",
        "with",
        "that",
        "this",
        "from",
        "have",
        "will",
        "into",
        "your",
        "about",
        "http",
        "https",
    }
    counts: dict[str, int] = {}
    for token in text.replace("\n", " ").split():
        cleaned = token.strip(".,:;!?()[]{}\"'").lower()
        if len(cleaned) < 4 or cleaned in stopwords:
            continue
        counts[cleaned] = counts.get(cleaned, 0) + 1
    ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return [word for word, _ in ranked[:10]]


@agent_task(timeout=5, retries=1, retry_delay=0.1)
def extract_preview(text: str) -> list[str]:
    """抽取前几句作为预览。"""

    sentences: list[str] = []
    current = []
    for char in text:
        current.append(char)
        if char in "。.!?":
            sentence = "".join(current).strip()
            if sentence:
                sentences.append(sentence)
            current = []
        if len(sentences) >= 3:
            break
    if not sentences and text.strip():
        sentences.append(text.strip()[:160])
    return sentences


@agent_task(timeout=5, retries=1, retry_delay=0.1)
def build_text_insights_report(
    stats: dict[str, int],
    headings: list[str],
    keywords: list[str],
    preview: list[str],
) -> dict[str, Any]:
    """聚合前面各步骤的结果。"""

    return {
        "stats": stats,
        "headings": headings,
        "keywords": keywords,
        "preview": preview,
    }


def run_text_insights(input_model: TextInsightsInput) -> dict[str, Any]:
    normalized = normalize_text(input_model.text)
    stats = compute_text_stats(normalized)
    headings = extract_headings(normalized)
    keywords = extract_keywords(normalized)
    preview = extract_preview(normalized)
    report = build_text_insights_report(stats, headings, keywords, preview)
    return resolve(report)


@agent_task(timeout=5, retries=1, retry_delay=0.1)
def build_skill_frontmatter(skill_name: str, purpose: str) -> str:
    """构造 skill frontmatter。"""

    return (
        "---\n"
        f"name: {skill_name}\n"
        f"description: {purpose}\n"
        "---"
    )


@agent_task(timeout=5, retries=1, retry_delay=0.1)
def build_skill_guidance(
    purpose: str,
    triggers: list[str],
    tools: list[str],
    constraints: list[str],
) -> dict[str, Any]:
    """生成 skill 的轻量指导结构。"""

    recommended_flow = [
        "先判断用户请求是否明确匹配该 skill 的适用范围",
        "必要时先读取 companion reference，再决定执行步骤",
        "优先遵循 skill 中定义的关键约束，不盲猜参数或流程",
        "完成任务后返回面向用户的最终结果",
    ]
    return {
        "purpose": purpose,
        "triggers": triggers,
        "tools": tools,
        "constraints": constraints,
        "recommended_flow": recommended_flow,
    }


@agent_task(timeout=10, retries=1, retry_delay=0.1)
def render_skill_markdown(
    frontmatter: str,
    skill_name: str,
    guidance: dict[str, Any],
) -> dict[str, str]:
    """把 skill 结构渲染成 SKILL.md / reference.md 草稿。"""

    trigger_lines = "\n".join(f"- {item}" for item in guidance["triggers"]) or "- 按技能主题显式触发"
    tool_lines = "\n".join(f"- {item}" for item in guidance["tools"]) or "- 根据任务需要选择合适工具"
    constraint_lines = "\n".join(f"- {item}" for item in guidance["constraints"]) or "- 保持技能说明精简，长说明下沉到 companion files"
    flow_lines = "\n".join(f"{index}. {step}" for index, step in enumerate(guidance["recommended_flow"], start=1))

    skill_md = (
        f"{frontmatter}\n\n"
        f"# {skill_name}\n\n"
        "当用户需要：\n\n"
        f"{trigger_lines}\n\n"
        "优先加载这个 skill。\n\n"
        "## 推荐流程\n\n"
        f"{flow_lines}\n\n"
        "## 关键约束\n\n"
        f"{constraint_lines}\n\n"
        "## 参考资料\n\n"
        "详细参数、长示例、实现细节见同目录的 `reference.md`\n"
    )

    reference_md = (
        f"# {skill_name} reference\n\n"
        f"## Purpose\n\n{guidance['purpose']}\n\n"
        f"## Suggested Tools\n\n{tool_lines}\n\n"
        f"## Constraints\n\n{constraint_lines}\n"
    )

    return {
        "SKILL.md": skill_md,
        "reference.md": reference_md,
    }


def run_skill_blueprint(input_model: SkillBlueprintInput) -> dict[str, Any]:
    frontmatter = build_skill_frontmatter(input_model.skill_name, input_model.purpose)
    guidance = build_skill_guidance(
        input_model.purpose,
        input_model.triggers,
        input_model.tools,
        input_model.constraints,
    )
    files = resolve(render_skill_markdown(frontmatter, input_model.skill_name, guidance))
    return {
        "skill_name": input_model.skill_name,
        "directory": f"skills/{input_model.skill_name}/",
        "files": files,
    }


BUILTIN_WORKFLOW_REGISTRY: dict[str, WorkflowDefinition] = {
    "text_insights": WorkflowDefinition(
        name="text_insights",
        description="并行提取文本统计、标题、关键词和预览，用于快速洞察文本结构。",
        input_model=TextInsightsInput,
        runner=run_text_insights,
        source="builtin",
        persistence="memory",
    ),
    "skill_blueprint": WorkflowDefinition(
        name="skill_blueprint",
        description="根据技能目的、触发场景和约束，生成符合官方推荐结构的 skill 草稿。",
        input_model=SkillBlueprintInput,
        runner=run_skill_blueprint,
        source="builtin",
        persistence="memory",
    ),
}


def register_runtime_workflow(definition: WorkflowDefinition) -> None:
    """注册进程级动态 workflow。"""

    _RUNTIME_WORKFLOW_REGISTRY[definition.name] = definition


def clear_runtime_workflows() -> None:
    _RUNTIME_WORKFLOW_REGISTRY.clear()


def _load_module_from_file(path: Path):
    module_name = f"agent_runtime_workflow_{path.stem}_{abs(hash(path))}"
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"无法加载 workflow 插件模块: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load_external_workflows() -> dict[str, WorkflowDefinition]:
    discovered: dict[str, WorkflowDefinition] = {}

    def register(definition: WorkflowDefinition) -> None:
        if definition.name in discovered:
            raise ValueError(f"重复的外部 workflow 名称: {definition.name}")
        discovered[definition.name] = definition

    for definition in _RUNTIME_WORKFLOW_REGISTRY.values():
        register(definition)

    WORKFLOW_PLUGINS_DIR.mkdir(parents=True, exist_ok=True)
    for plugin_path in sorted(WORKFLOW_PLUGINS_DIR.glob("*.py")):
        module = _load_module_from_file(plugin_path)
        register_workflows = getattr(module, "register_workflows", None)
        if callable(register_workflows):
            register_workflows(register)
            continue
        workflows = getattr(module, "WORKFLOWS", None)
        if isinstance(workflows, list):
            for item in workflows:
                register(item)

    import os

    module_names = [item.strip() for item in os.getenv("APP_WORKFLOW_MODULES", "").split(",") if item.strip()]
    for module_name in module_names:
        module = importlib.import_module(module_name)
        register_workflows = getattr(module, "register_workflows", None)
        if callable(register_workflows):
            register_workflows(register)
            continue
        workflows = getattr(module, "WORKFLOWS", None)
        if isinstance(workflows, list):
            for item in workflows:
                register(item)

    return discovered


def _merged_registry() -> dict[str, WorkflowDefinition]:
    merged = dict(BUILTIN_WORKFLOW_REGISTRY)
    for name, definition in _load_external_workflows().items():
        if name in merged:
            raise ValueError(f"外部 workflow 与内置 workflow 同名: {name}")
        merged[name] = definition
    return merged


def list_workflows() -> list[WorkflowDefinitionSummary]:
    return [
        WorkflowDefinitionSummary(
            name=workflow.name,
            description=workflow.description,
            input_schema=workflow.input_model.model_json_schema(),
        )
        for workflow in _merged_registry().values()
    ]


def get_workflow(name: str) -> WorkflowDefinition:
    registry = _merged_registry()
    try:
        return registry[name]
    except KeyError as exc:
        raise KeyError(f"未知 workflow: {name}") from exc


def get_workflow_catalog() -> WorkflowCatalogResponse:
    return WorkflowCatalogResponse(
        workflows=[
            WorkflowHostDescriptor(
                name=definition.name,
                source=definition.source,
                persistence=definition.persistence,  # type: ignore[arg-type]
                description=definition.description,
            )
            for definition in sorted(_merged_registry().values(), key=lambda item: item.name)
        ]
    )
