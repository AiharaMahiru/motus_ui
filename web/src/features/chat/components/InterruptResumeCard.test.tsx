import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { InterruptResumeCard } from './InterruptResumeCard'


describe('InterruptResumeCard', () => {
  it('submits official answers mapping for multi-question user input interrupts', () => {
    const onSubmit = vi.fn()

    render(
      <InterruptResumeCard
        disabled={false}
        interrupt={{
          interrupt_id: 'resume-1',
          type: 'user_input',
          resumable: true,
          payload: {
            questions: [
              {
                question: '是否继续当前操作？',
                header: '继续确认',
                options: [
                  { label: '继续', description: '继续执行当前流程' },
                  { label: '取消', description: '终止当前流程' },
                ],
              },
              {
                question: '请补充发布窗口',
                options: [],
              },
            ],
          },
        }}
        submitting={false}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /继续执行当前流程/i }))
    fireEvent.change(screen.getByPlaceholderText('输入你的回复'), {
      target: { value: '今晚 20:00' },
    })
    fireEvent.click(screen.getByRole('button', { name: '提交回复' }))

    expect(onSubmit).toHaveBeenCalledWith('resume-1', {
      answers: {
        '是否继续当前操作？': '继续',
        '请补充发布窗口': '今晚 20:00',
      },
    })
  })

  it('submits approval payload for approval interrupts', () => {
    const onSubmit = vi.fn()

    render(
      <InterruptResumeCard
        disabled={false}
        interrupt={{
          interrupt_id: 'approve-1',
          type: 'approval',
          resumable: true,
          payload: {
            question: '是否允许继续执行？',
          },
        }}
        submitting={false}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('可选：补充批准原因或限制条件'), {
      target: { value: '仅限测试环境' },
    })
    fireEvent.click(screen.getByRole('button', { name: '批准并继续' }))

    expect(onSubmit).toHaveBeenCalledWith('approve-1', {
      approved: true,
      note: '仅限测试环境',
    })
  })

  it('treats tool_approval as approval interrupt and renders approve action', () => {
    const onSubmit = vi.fn()

    render(
      <InterruptResumeCard
        disabled={false}
        interrupt={{
          interrupt_id: 'tool-approve-1',
          type: 'tool_approval',
          resumable: true,
          payload: {
            question: '是否允许调用 bash？',
          },
        }}
        submitting={false}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.click(screen.getByTestId('interrupt-approve-button'))

    expect(onSubmit).toHaveBeenCalledWith('tool-approve-1', {
      approved: true,
      note: undefined,
    })
  })
})
