from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


ResponseScalarType = Literal[
    "string",
    "integer",
    "number",
    "boolean",
]

ResponseLegacyArrayType = Literal[
    "string[]",
    "integer[]",
    "number[]",
    "boolean[]",
]

ResponseNodeType = Literal[
    "string",
    "integer",
    "number",
    "boolean",
    "string[]",
    "integer[]",
    "number[]",
    "boolean[]",
    "object",
    "array",
]


class ResponseSchemaNode(BaseModel):
    """声明式结构化输出节点。"""

    type: ResponseNodeType = Field(default="string", description="节点类型")
    description: str | None = Field(default=None, description="节点说明")
    nullable: bool = Field(default=False, description="节点值是否允许为 null")
    properties: list["ResponseFieldConfig"] = Field(default_factory=list, description="object 子字段")
    items: "ResponseSchemaNode | None" = Field(default=None, description="array 子项 schema")

    @model_validator(mode="after")
    def validate_children(self) -> "ResponseSchemaNode":
        if self.type == "object" and self.items is not None:
            raise ValueError("object 类型不能同时定义 items")
        if self.type == "array" and self.properties:
            raise ValueError("array 类型不能直接定义 properties，请写到 items 里")
        if self.type == "array" and self.items is None:
            raise ValueError("array 类型必须定义 items")
        if self.type != "object" and self.properties:
            raise ValueError("只有 object 类型可以定义 properties")
        if self.type.endswith("[]") and (self.properties or self.items is not None):
            raise ValueError("旧版数组简写类型不能再额外定义 properties/items")
        if self.type not in {"array"} and self.items is not None:
            raise ValueError("只有 array 类型可以定义 items")
        return self


class ResponseFieldConfig(BaseModel):
    """对象字段声明。

    兼容旧版扁平字段：
    - 继续允许直接传 `type=string`
    - 新版通过 `schema={...}` 支持嵌套 object/array
    """

    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., min_length=1, description="字段名")
    type: ResponseNodeType | None = Field(default=None, description="兼容旧版的简写字段类型")
    schema_config: ResponseSchemaNode | None = Field(
        default=None,
        alias="schema",
        description="新版字段 schema",
    )
    description: str | None = Field(default=None, description="字段说明")
    required: bool = Field(default=True, description="是否必填")

    @model_validator(mode="after")
    def normalize_schema(self) -> "ResponseFieldConfig":
        if self.schema_config is None and self.type is None:
            raise ValueError("response_format 字段必须至少提供 type 或 schema")
        if (
            self.schema_config is not None
            and self.type is not None
            and not (self.type.endswith("[]") and self.schema_config.type == "array")
            and self.schema_config.type != self.type
        ):
            raise ValueError("response_format 字段的 type 与 schema.type 不一致")
        if self.schema_config is None and self.type is not None:
            if self.type.endswith("[]"):
                scalar_type = self.type[:-2]
                self.schema_config = ResponseSchemaNode(
                    type="array",
                    description=self.description,
                    items=ResponseSchemaNode(type=scalar_type),  # type: ignore[arg-type]
                )
            else:
                self.schema_config = ResponseSchemaNode(
                    type=self.type,
                    description=self.description,
                )
        elif self.schema_config is not None and self.description and not self.schema_config.description:
            self.schema_config.description = self.description
        return self


ResponseSchemaNode.model_rebuild()


class ResponseFormatConfig(BaseModel):
    """面向会话配置的结构化输出模型声明。"""

    name: str = Field(default="structured_response", min_length=1, description="生成的 Pydantic 模型名")
    description: str | None = Field(default=None, description="模型用途说明")
    fields: list[ResponseFieldConfig] = Field(default_factory=list, description="顶层 object 字段列表")

    @model_validator(mode="after")
    def validate_fields(self) -> "ResponseFormatConfig":
        names = [field.name for field in self.fields]
        if len(names) != len(set(names)):
            raise ValueError("response_format.fields 中存在重复字段名")
        return self

    def enabled(self) -> bool:
        return bool(self.fields)
