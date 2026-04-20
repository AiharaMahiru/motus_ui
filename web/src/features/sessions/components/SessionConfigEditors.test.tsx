import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  GuardrailListEditor,
  McpServerListEditor,
  ResponseFormatEditor,
} from './SessionConfigEditors'

describe('SessionConfigEditors', () => {
  it('adds a response field through the structured response editor', () => {
    const onChange = vi.fn()

    render(
      <ResponseFormatEditor
        value={{
          name: 'structured_response',
          description: '',
          fields: [],
        }}
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /新增字段/ }))

    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls[0][0].fields).toHaveLength(1)
  })

  it('adds a new guardrail rule card', () => {
    const onChange = vi.fn()

    render(<GuardrailListEditor label="input_guardrails" rules={[]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /新增规则/ }))

    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls[0][0]).toHaveLength(1)
  })

  it('adds remote and local mcp server cards', () => {
    const onChange = vi.fn()

    render(<McpServerListEditor onChange={onChange} servers={[]} />)

    fireEvent.click(screen.getByRole('button', { name: /远端 HTTP/ }))
    fireEvent.click(screen.getByRole('button', { name: /本地命令/ }))

    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange.mock.calls[0][0][0].transport).toBe('remote_http')
    expect(onChange.mock.calls[1][0][0].transport).toBe('local_stdio')
  })
})
