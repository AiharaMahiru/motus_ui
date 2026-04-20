import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SessionSidebar, SessionSidebarRail } from './SessionSidebar'


describe('SessionSidebar', () => {
  it('renders the session list and forwards delete events', () => {
    const onDeleteSession = vi.fn()
    const { container } = render(
      <SessionSidebar
        onComposeNewSession={() => undefined}
        onDeleteSession={onDeleteSession}
        onSearchChange={() => undefined}
        onSelectSession={() => undefined}
        searchTerm=""
        selectedSessionId="s-1"
        sessions={[
          {
            session_id: 's-1',
            title: '规划会话',
            status: 'idle',
            model_name: 'gpt-5.4',
            created_at: '2026-04-16T00:00:00Z',
            updated_at: '2026-04-16T00:00:00Z',
            message_count: 2,
            total_usage: { total_tokens: 128 },
            total_cost_usd: 0.12,
            last_error: null,
            multi_agent_enabled: false,
            specialist_count: 0,
            project_root: '/opt/Agent',
            trace_log_dir: '/opt/Agent/runtime/traces/sessions/s-1',
          },
        ]}
      />,
    )

    expect(screen.getByText('规划会话')).toBeInTheDocument()
    fireEvent.click(container.querySelector('.sidebar-delete-button')!)
    expect(onDeleteSession).toHaveBeenCalledWith('s-1')
  })

  it('disables delete while the target session is being removed', () => {
    const onDeleteSession = vi.fn()
    render(
      <SessionSidebar
        deletingSessionId="s-1"
        onComposeNewSession={() => undefined}
        onDeleteSession={onDeleteSession}
        onSearchChange={() => undefined}
        onSelectSession={() => undefined}
        searchTerm=""
        selectedSessionId="s-1"
        sessions={[
          {
            session_id: 's-1',
            title: '规划会话',
            status: 'idle',
            model_name: 'gpt-5.4',
            created_at: '2026-04-16T00:00:00Z',
            updated_at: '2026-04-16T00:00:00Z',
            message_count: 2,
            total_usage: { total_tokens: 128 },
            total_cost_usd: 0.12,
            last_error: null,
            multi_agent_enabled: false,
            specialist_count: 0,
            project_root: '/opt/Agent',
            trace_log_dir: '/opt/Agent/runtime/traces/sessions/s-1',
          },
        ]}
      />,
    )

    const deleteButton = screen.getByRole('button', { name: '正在删除会话 规划会话' })
    expect(deleteButton).toBeDisabled()
    fireEvent.click(deleteButton)
    expect(onDeleteSession).not.toHaveBeenCalled()
  })

  it('renders collapsed rail sessions and forwards select events', () => {
    const onSelectSession = vi.fn()
    render(
      <SessionSidebarRail
        onComposeNewSession={() => undefined}
        onSelectSession={onSelectSession}
        selectedSessionId="s-1"
        sessions={[
          {
            session_id: 's-1',
            title: '规划会话',
            status: 'idle',
            model_name: 'gpt-5.4',
            created_at: '2026-04-16T00:00:00Z',
            updated_at: '2026-04-16T00:00:00Z',
            message_count: 2,
            total_usage: { total_tokens: 128 },
            total_cost_usd: 0.12,
            last_error: null,
            multi_agent_enabled: false,
            specialist_count: 0,
            project_root: '/opt/Agent',
            trace_log_dir: '/opt/Agent/runtime/traces/sessions/s-1',
          },
        ]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '切换到会话 规划会话' }))
    expect(onSelectSession).toHaveBeenCalledWith('s-1')
  })
})
