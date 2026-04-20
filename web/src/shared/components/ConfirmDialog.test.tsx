import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders and forwards confirm or cancel actions', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()

    render(
      <ConfirmDialog
        cancelLabel="取消"
        confirmLabel="确认删除"
        description="删除后无法恢复。"
        open
        title="确认删除这个会话？"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('locks cancel while busy', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        busy
        cancelLabel="取消"
        confirmLabel="确认删除"
        open
        title="确认删除这个会话？"
        onCancel={onCancel}
        onConfirm={() => undefined}
      />,
    )

    const cancelButton = screen.getByRole('button', { name: '取消' })
    expect(cancelButton).toBeDisabled()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).not.toHaveBeenCalled()
  })
})
