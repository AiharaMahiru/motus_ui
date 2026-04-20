import type { ChatMessage } from '../../../shared/api/contracts'


export type SkillMessagePayload = {
  skillName: string
  directory: string
  summary?: string
  markdown: string
}

function stripWrappedQuotes(value: string) {
  return value.replace(/^"+|"+$/g, '').trim()
}

function messageName(message: ChatMessage) {
  return typeof message.name === 'string' ? message.name : undefined
}

export function parseSkillMessage(message: ChatMessage, content: string): SkillMessagePayload | null {
  const normalizedContent = stripWrappedQuotes(content)
  const toolName = messageName(message)
  if (toolName !== 'load_skill' && !normalizedContent.startsWith('Skill directory:')) {
    return null
  }

  const lines = normalizedContent.split('\n')
  const directoryLine = lines.find((line) => line.startsWith('Skill directory:'))
  if (!directoryLine) {
    return null
  }

  const directory = directoryLine.replace('Skill directory:', '').trim()
  const headingLine = lines.find((line) => line.startsWith('# '))
  const skillName = headingLine?.replace(/^#\s+/, '').trim() || directory.split('/').pop() || 'skill'
  const summary = lines
    .find((line) => {
      const trimmed = line.trim()
      return Boolean(trimmed) && !trimmed.startsWith('#') && !trimmed.startsWith('Skill directory:')
    })
    ?.trim()

  return {
    directory,
    markdown: normalizedContent,
    skillName,
    summary,
  }
}
