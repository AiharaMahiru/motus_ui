import { describe, expect, it } from 'vitest'

import { parseWebSearchMessage } from './webSearchMessage'


describe('parseWebSearchMessage', () => {
  it('parses web_search tool output into result items', () => {
    const payload = parseWebSearchMessage(
      {
        role: 'tool',
        name: 'web_search',
      } as never,
      JSON.stringify({
        web: [
          {
            url: 'https://www.reuters.com/technology/artificial-intelligence/',
            title: 'AI News | Reuters',
            description: 'Latest AI developments from Reuters.',
          },
        ],
      }),
    )

    expect(payload?.toolName).toBe('web_search')
    expect(payload?.results).toHaveLength(1)
    expect(payload?.results[0].title).toBe('AI News | Reuters')
  })
})
