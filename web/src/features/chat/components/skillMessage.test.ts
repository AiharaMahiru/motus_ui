import { describe, expect, it } from 'vitest'

import { parseSkillMessage } from './skillMessage'


describe('parseSkillMessage', () => {
  it('parses load_skill tool output into a dedicated payload', () => {
    const payload = parseSkillMessage(
      {
        role: 'tool',
        name: 'load_skill',
      } as never,
      [
        'Skill directory: /opt/Agent/skills/minimax-docx',
        '',
        '# minimax-docx',
        '',
        'Create, edit, and format DOCX documents.',
      ].join('\n'),
    )

    expect(payload?.skillName).toBe('minimax-docx')
    expect(payload?.directory).toBe('/opt/Agent/skills/minimax-docx')
    expect(payload?.summary).toBe('Create, edit, and format DOCX documents.')
  })
})
