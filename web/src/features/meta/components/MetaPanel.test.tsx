import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MetaPanel } from './MetaPanel'

describe('MetaPanel', () => {
  it('renders backend mode and capability probes', () => {
    render(
      <MetaPanel
        meta={{
          app_version: '1.0.0',
          desktop_mode: false,
          backend_mode: 'local',
          api_base_url: 'http://127.0.0.1:8000',
          runtime_dir: '/tmp/runtime',
          project_root: '/tmp/project',
          server_started_at: '2026-04-18T00:00:00Z',
          supports_interrupts: false,
          supports_dynamic_session_config: true,
          supports_preview: true,
          supports_structured_response_format: false,
        }}
      />,
    )

    expect(screen.getByText('后端模式')).toBeInTheDocument()
    expect(screen.getByText('local')).toBeInTheDocument()
    expect(screen.getByText('支持动态会话配置')).toBeInTheDocument()
    expect(screen.getAllByText('是').length).toBeGreaterThan(0)
    expect(screen.getAllByText('否').length).toBeGreaterThan(0)
  })
})
