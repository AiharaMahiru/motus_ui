export type PreviewRequestLanguage = 'html' | 'react' | 'jsx' | 'tsx' | 'python' | 'py'


export function buildPreviewRequestKey(language: PreviewRequestLanguage, code: string) {
  let hash = 0
  for (const char of code) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return `${language}:${hash.toString(36)}`
}


export function resolvePreviewLanguage(className?: string, code?: string): PreviewRequestLanguage | null {
  const language = /language-([a-z0-9-]+)/i.exec(className ?? '')?.[1]?.toLowerCase()
  const source = code ?? ''

  if (language === 'html' || language === 'htm') {
    return 'html'
  }
  if (language === 'react' || language === 'jsx' || language === 'tsx') {
    return language
  }
  if (language === 'python' || language === 'py') {
    return language
  }
  if (language === 'javascript' || language === 'js' || language === 'typescript' || language === 'ts') {
    if (
      /\bfrom\s+['"]react['"]/.test(source) ||
      /\bfrom\s+['"]react-dom\/client['"]/.test(source) ||
      /\bcreateRoot\s*\(/.test(source) ||
      /\bReactDOM\./.test(source) ||
      /\bexport\s+default\s+function\s+App\b/.test(source) ||
      /\bfunction\s+App\s*\(/.test(source)
    ) {
      return 'react'
    }
  }
  return null
}


export function formatPreviewLanguageLabel(language: PreviewRequestLanguage) {
  switch (language) {
    case 'html':
      return 'HTML'
    case 'react':
    case 'jsx':
    case 'tsx':
      return 'React'
    case 'python':
    case 'py':
      return 'Python'
    default:
      return language
  }
}
