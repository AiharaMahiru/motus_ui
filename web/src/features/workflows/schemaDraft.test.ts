import { describe, expect, it } from 'vitest'

import { buildStarterInputFromSchema, extractWorkflowFields, formatWorkflowJson } from './schemaDraft'


describe('workflow schema helpers', () => {
  it('can extract top level fields from schema', () => {
    const fields = extractWorkflowFields({
      type: 'object',
      required: ['text'],
      properties: {
        text: {
          type: 'string',
          description: '待分析文本',
        },
        tags: {
          type: 'array',
          description: '标签列表',
          items: { type: 'string' },
        },
      },
    })

    expect(fields).toHaveLength(2)
    expect(fields[0]).toMatchObject({
      name: 'text',
      type: 'string',
      required: true,
    })
  })

  it('can build starter input and format json', () => {
    const payload = buildStarterInputFromSchema({
      type: 'object',
      required: ['skill_name', 'triggers'],
      properties: {
        skill_name: {
          type: 'string',
          description: '技能名称',
        },
        triggers: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    })

    expect(payload).toEqual({
      skill_name: '技能名称',
      triggers: ['请填写 triggers'],
    })
    expect(formatWorkflowJson('{"a":1}')).toBe('{\n  "a": 1\n}')
  })
})
