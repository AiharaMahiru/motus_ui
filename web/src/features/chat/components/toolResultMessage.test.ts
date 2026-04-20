import { describe, expect, it } from 'vitest'

import { parseToolResultMessage } from './toolResultMessage'


describe('parseToolResultMessage', () => {
  it('parses normal tool text output into a dedicated payload', () => {
    const payload = parseToolResultMessage(
      {
        role: 'tool',
        name: 'office_cli',
      } as never,
      '"Created: /tmp/science_news_report.docx"',
    )

    expect(payload?.toolName).toBe('office_cli')
    expect(payload?.status).toBe('success')
    expect(payload?.summary).toBe('Created: /tmp/science_news_report.docx')
  })
})
