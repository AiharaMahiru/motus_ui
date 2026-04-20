import { useCallback, useEffect, useRef, useState } from 'react'

import {
  createComposerAttachment,
  releaseComposerAttachment,
  type ComposerAttachment,
} from '../attachments'

type UseComposerAttachmentsOptions = {
  limit: number
}

export function useComposerAttachments({ limit }: UseComposerAttachmentsOptions) {
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([])
  const composerAttachmentsRef = useRef<ComposerAttachment[]>([])

  const appendComposerFiles = useCallback((files: File[]) => {
    if (files.length === 0) {
      return
    }

    setComposerAttachments((current) => {
      const next = [...current]
      for (const file of files) {
        if (next.length >= limit) {
          break
        }
        const duplicated = next.some(
          (item) =>
            item.name === file.name &&
            item.size === file.size &&
            item.file.lastModified === file.lastModified,
        )
        if (duplicated) {
          continue
        }
        next.push(createComposerAttachment(file))
      }
      return next
    })
  }, [limit])

  const removeComposerAttachment = useCallback((attachmentId: string) => {
    setComposerAttachments((current) => {
      const target = current.find((attachment) => attachment.id === attachmentId)
      if (target) {
        releaseComposerAttachment(target)
      }
      return current.filter((attachment) => attachment.id !== attachmentId)
    })
  }, [])

  const clearComposerAttachments = useCallback(({ release = true }: { release?: boolean } = {}) => {
    setComposerAttachments((current) => {
      if (release) {
        current.forEach(releaseComposerAttachment)
      }
      return []
    })
  }, [])

  useEffect(() => {
    composerAttachmentsRef.current = composerAttachments
  }, [composerAttachments])

  useEffect(() => {
    return () => {
      composerAttachmentsRef.current.forEach(releaseComposerAttachment)
    }
  }, [])

  return {
    clearComposerAttachments,
    composerAttachments,
    composerAttachmentsRef,
    appendComposerFiles,
    removeComposerAttachment,
    setComposerAttachments,
  }
}
