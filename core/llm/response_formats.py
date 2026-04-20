from __future__ import annotations

from typing import Any

from pydantic import Field, create_model

from core.schemas.response_format import ResponseFieldConfig, ResponseFormatConfig, ResponseSchemaNode


def _resolve_scalar_type(node_type: str) -> Any:
    mapping: dict[str, Any] = {
        "string": str,
        "integer": int,
        "number": float,
        "boolean": bool,
    }
    return mapping[node_type]


def _build_node_annotation(model_name: str, node: ResponseSchemaNode) -> Any:
    if node.type in {"string", "integer", "number", "boolean"}:
        annotation = _resolve_scalar_type(node.type)
    elif node.type == "object":
        field_definitions: dict[str, tuple[Any, Any]] = {}
        for field in node.properties:
            child_schema = field.schema_config
            if child_schema is None:
                raise ValueError(f"字段 {field.name} 缺少 schema")
            child_annotation = _build_node_annotation(f"{model_name}_{field.name}", child_schema)
            if not field.required:
                child_annotation = child_annotation | None
            child_default = ... if field.required else None
            field_definitions[field.name] = (
                child_annotation,
                Field(default=child_default, description=child_schema.description or field.description),
            )
        annotation = create_model(
            model_name,
            __doc__=node.description,
            **field_definitions,
        )
    elif node.type == "array":
        if node.items is None:
            raise ValueError(f"数组节点 {model_name} 缺少 items")
        annotation = list[_build_node_annotation(f"{model_name}Item", node.items)]
    else:
        raise ValueError(f"未知 response_format 节点类型: {node.type}")

    if node.nullable:
        return annotation | None
    return annotation


def build_response_format_model(config: ResponseFormatConfig | None):
    """把声明式 response_format 配置转换成 Pydantic 模型。"""

    if config is None or not config.enabled():
        return None

    field_definitions: dict[str, tuple[Any, Any]] = {}
    for field in config.fields:
        child_schema = field.schema_config
        if child_schema is None:
            raise ValueError(f"字段 {field.name} 缺少 schema")
        annotation = _build_node_annotation(f"{config.name}_{field.name}", child_schema)
        if not field.required:
            annotation = annotation | None
        default = ... if field.required else None
        field_definitions[field.name] = (
            annotation,
            Field(default=default, description=child_schema.description or field.description),
        )

    model = create_model(
        config.name,
        __doc__=config.description,
        **field_definitions,
    )
    return model
