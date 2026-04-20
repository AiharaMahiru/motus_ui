type JsonSchema = Record<string, unknown>

export type WorkflowFieldSummary = {
  name: string
  type: string
  description: string
  required: boolean
}


function isObjectSchema(value: unknown): value is JsonSchema {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}


function readSchemaType(schema: JsonSchema) {
  const rawType = schema.type
  if (typeof rawType === 'string') {
    return rawType
  }
  if (Array.isArray(rawType)) {
    const first = rawType.find((item) => typeof item === 'string')
    return typeof first === 'string' ? first : 'unknown'
  }
  if (isObjectSchema(schema.properties)) {
    return 'object'
  }
  return 'unknown'
}


function buildExampleValue(schema: JsonSchema, fieldName = 'value'): unknown {
  const type = readSchemaType(schema)
  const description = typeof schema.description === 'string' ? schema.description : ''

  if (schema.default !== undefined) {
    return schema.default
  }

  switch (type) {
    case 'string':
      return description || `请填写 ${fieldName}`
    case 'integer':
    case 'number':
      return 0
    case 'boolean':
      return false
    case 'array': {
      const items = isObjectSchema(schema.items) ? schema.items : {}
      // 数组字段默认给一个示例元素，便于用户一眼看出 items 的形状。
      const child = buildExampleValue(items, fieldName)
      return child === undefined ? [] : [child]
    }
    case 'object': {
      const properties = isObjectSchema(schema.properties) ? schema.properties : {}
      const required = Array.isArray(schema.required)
        ? new Set(schema.required.filter((item): item is string => typeof item === 'string'))
        : new Set<string>()
      const result: Record<string, unknown> = {}
      for (const [name, child] of Object.entries(properties)) {
        if (!isObjectSchema(child)) {
          continue
        }
        // 对象字段优先保留必填项；如果可选字段本身有默认值或明确类型，也补进示例里。
        if (!required.has(name) && child.default === undefined && readSchemaType(child) === 'unknown') {
          continue
        }
        result[name] = buildExampleValue(child, name)
      }
      return result
    }
    default:
      return ''
  }
}


export function extractWorkflowFields(schema: JsonSchema): WorkflowFieldSummary[] {
  const properties = isObjectSchema(schema.properties) ? schema.properties : {}
  const requiredSet = Array.isArray(schema.required)
    ? new Set(schema.required.filter((item): item is string => typeof item === 'string'))
    : new Set<string>()

  return Object.entries(properties).flatMap(([name, value]) => {
    if (!isObjectSchema(value)) {
      return []
    }
    return [
      {
        name,
        type: readSchemaType(value),
        description:
          typeof value.description === 'string' && value.description.trim()
            ? value.description
            : '暂无字段说明',
        required: requiredSet.has(name),
      },
    ]
  })
}


export function buildStarterInputFromSchema(schema: JsonSchema) {
  const starter = buildExampleValue(schema, 'input')
  return isObjectSchema(starter) ? starter : {}
}


export function formatWorkflowJson(text: string) {
  return JSON.stringify(JSON.parse(text), null, 2)
}
