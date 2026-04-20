import { describe, expect, it } from 'vitest'

import { formatCost, renderMessageContent } from './format'


describe('formatCost', () => {
  it('returns 未计价 when cost is missing', () => {
    expect(formatCost(undefined)).toBe('未计价')
    expect(formatCost(null)).toBe('未计价')
  })
})

describe('renderMessageContent', () => {
  it('preserves escaped control characters inside code blocks', () => {
    const content = ['```python', 'print("\\\\n".join(["a", "b"]))', '```'].join('\n')

    expect(
      renderMessageContent({
        content,
        role: 'assistant',
      } as never),
    ).toBe(content)
  })
})
