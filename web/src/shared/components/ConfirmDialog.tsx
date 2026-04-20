import { AlertTriangle, LoaderCircle } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { useI18n } from '../i18n/I18nContext'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description?: string
  confirmLabel: string
  cancelLabel: string
  busy?: boolean
  tone?: 'default' | 'danger'
  children?: ReactNode
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  busy = false,
  tone = 'default',
  children,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const { text } = useI18n()

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [busy, onCancel, open])

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open || typeof document === 'undefined') {
    return null
  }

  const destructive = tone === 'danger'

  return createPortal(
    <div
      className="confirm-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (busy) {
          return
        }
        if (event.target === event.currentTarget) {
          onCancel()
        }
      }}
    >
      <div
        aria-busy={busy}
        aria-modal="true"
        className="confirm-dialog-panel"
        role="dialog"
      >
        <div className="confirm-dialog-header">
          <div className={destructive ? 'confirm-dialog-icon confirm-dialog-icon-danger' : 'confirm-dialog-icon'}>
            {busy ? <LoaderCircle className="animate-spin" size={18} /> : <AlertTriangle size={18} />}
          </div>
          <div className="confirm-dialog-copy">
            <div className="confirm-dialog-kicker">
              {destructive ? text('危险操作', 'Danger zone') : text('操作确认', 'Confirm action')}
            </div>
            <h2 className="confirm-dialog-title">{title}</h2>
            {description ? <p className="confirm-dialog-description">{description}</p> : null}
          </div>
        </div>

        {children ? <div className="confirm-dialog-body">{children}</div> : null}

        <div className="confirm-dialog-actions">
          <button
            className="confirm-dialog-button confirm-dialog-button-secondary"
            disabled={busy}
            type="button"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className={
              destructive
                ? 'confirm-dialog-button confirm-dialog-button-danger'
                : 'confirm-dialog-button confirm-dialog-button-primary'
            }
            disabled={busy}
            type="button"
            onClick={() => {
              void onConfirm()
            }}
          >
            {busy ? <LoaderCircle className="animate-spin" size={14} /> : null}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
