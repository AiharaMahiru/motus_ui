import { describe, expect, it } from 'vitest'

import { groupConsecutiveAssistantMessages } from './messageGroups'


describe('groupConsecutiveAssistantMessages', () => {
  it('groups adjacent visible tool messages together', () => {
    const grouped = groupConsecutiveAssistantMessages([
      {
        role: 'assistant',
        content: '',
      } as never,
      {
        role: 'tool',
        name: 'web_search',
        content: '{"web":[]}',
      } as never,
      {
        role: 'tool',
        name: 'office_cli',
        content: '"Created: /tmp/report.docx"',
      } as never,
      {
        role: 'assistant',
        content: '最终回答',
      } as never,
    ])

    expect(grouped).toHaveLength(2)
    expect(grouped[0].type).toBe('tool-group')
    if (grouped[0].type === 'tool-group') {
      expect(grouped[0].messages).toHaveLength(2)
    }
    expect(grouped[1].type).toBe('message')
  })
})
