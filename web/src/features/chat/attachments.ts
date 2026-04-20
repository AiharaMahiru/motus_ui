export type ComposerAttachment = {
  file: File
  id: string
  kind: 'image' | 'file'
  mimeType: string
  name: string
  previewUrl?: string
  size: number
}

export type MessageAttachmentMeta = {
  file_name?: string
  file_path?: string
  id?: string
  kind?: 'image' | 'file'
  mime_type?: string
  size_bytes?: number
  size_label?: string
}

export function createComposerAttachment(file: File): ComposerAttachment {
  const kind = file.type.startsWith('image/') ? 'image' : 'file'
  return {
    file,
    id: `${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    kind,
    mimeType: file.type || 'application/octet-stream',
    name: file.name,
    previewUrl: kind === 'image' ? URL.createObjectURL(file) : undefined,
    size: file.size,
  }
}

export function releaseComposerAttachment(attachment: ComposerAttachment) {
  if (attachment.previewUrl) {
    URL.revokeObjectURL(attachment.previewUrl)
  }
}

export function formatAttachmentSize(size: number | undefined) {
  if (typeof size !== 'number' || Number.isNaN(size)) {
    return ''
  }
  let value = size
  const units = ['B', 'KB', 'MB', 'GB']
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)}${units[index]}`
}

export function normalizeMessageAttachments(value: unknown): MessageAttachmentMeta[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is MessageAttachmentMeta => Boolean(item) && typeof item === 'object')
}
