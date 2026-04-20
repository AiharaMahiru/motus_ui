import { describe, expect, it } from 'vitest'

import { parseTodoToolCall, parseTodoToolMessage } from './todoMessage'


describe('todoMessage', () => {
  it('parses to_do tool output', () => {
    const todos = parseTodoToolMessage(
      {
        role: 'tool',
        name: 'to_do',
      } as never,
      JSON.stringify([
        {
          content: '搜索新闻',
          status: 'in_progress',
          activeForm: '正在搜索新闻',
        },
      ]),
    )

    expect(todos).toHaveLength(1)
    expect(todos?.[0].content).toBe('搜索新闻')
  })

  it('parses to_do tool call arguments from live step events', () => {
    const todos = parseTodoToolCall({
      function: {
        name: 'to_do',
        arguments: JSON.stringify({
          todos: [
            {
              content: '生成文档',
              status: 'pending',
              activeForm: '准备生成文档',
            },
          ],
        }),
      },
    })

    expect(todos).toHaveLength(1)
    expect(todos?.[0].activeForm).toBe('准备生成文档')
  })
})
