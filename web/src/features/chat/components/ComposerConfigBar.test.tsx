import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_SESSION_DRAFT } from '../../sessions/constants'
import { ComposerConfigBar } from './ComposerConfigBar'


describe('ComposerConfigBar', () => {
  it('opens rounded option menu and forwards thinking selection', () => {
    const onConfigChange = vi.fn()

    render(
      <ComposerConfigBar
        config={{
          ...DEFAULT_SESSION_DRAFT,
          modelName: 'gpt-4o',
          enabledTools: ['bash'],
        }}
        saveState="idle"
        onConfigChange={onConfigChange}
        onOpenAdvancedConfig={() => undefined}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '思考' }))
    fireEvent.click(screen.getAllByRole('option').find((node) => node.textContent?.trim() === 'high')!)

    expect(onConfigChange).toHaveBeenCalledWith({
      thinkingEffort: 'high',
      thinkingEnabled: true,
    })
  })

  it('renders minimal summary mode for narrow composer layouts', () => {
    render(
      <ComposerConfigBar
        config={{
          ...DEFAULT_SESSION_DRAFT,
          modelName: 'gpt-4o',
          enabledTools: ['bash', 'read_file', 'write_file'],
        }}
        minimal
        saveState="saved"
        onConfigChange={() => undefined}
        onOpenAdvancedConfig={() => undefined}
      />,
    )

    expect(screen.getByText('gpt-4o')).toBeInTheDocument()
    expect(screen.getByText('openai')).toBeInTheDocument()
    expect(screen.getByText('medium')).toBeInTheDocument()
    expect(screen.getByText('配置已同步')).toBeInTheDocument()
  })

  it('supports model-only mode for streamlined composer layouts', () => {
    render(
      <ComposerConfigBar
        config={{
          ...DEFAULT_SESSION_DRAFT,
          modelName: 'gpt-4o',
          enabledTools: ['bash', 'read_file', 'write_file'],
        }}
        saveState="saved"
        showSaveState={false}
        visibleFields={['provider', 'model']}
        onConfigChange={() => undefined}
        onOpenAdvancedConfig={() => undefined}
      />,
    )

    expect(screen.getByRole('button', { name: 'Provider' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '模型' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '思考' })).not.toBeInTheDocument()
    expect(screen.queryByText('配置已同步')).not.toBeInTheDocument()
  })
})
