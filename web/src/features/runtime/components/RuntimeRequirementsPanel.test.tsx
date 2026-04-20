import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RuntimeRequirementsPanel } from './RuntimeRequirementsPanel'


describe('RuntimeRequirementsPanel', () => {
  it('marks active tool requirements as relevant', () => {
    render(
      <RuntimeRequirementsPanel
        enabledTools={['read_file']}
        payload={{
          generated_at: '2026-04-16T00:00:00Z',
          project_root: '/opt/Agent',
          ready_count: 1,
          missing_count: 1,
          manual_count: 0,
          checks: [
            {
              requirement: {
                key: 'python-runtime',
                label: 'Python 3 / uv',
                category: 'shared',
                requirement_type: 'stack',
                summary: '核心运行时',
                install_hint: '安装 uv',
                required_by: ['read_file'],
                notes: [],
                binaries: ['uv'],
                env_vars: [],
                modules: [],
                files: [],
                manual: false,
              },
              status: 'ready',
              detail: '已满足当前检测条件。',
            },
          ],
        }}
      />,
    )

    expect(screen.getByText('当前相关')).toBeInTheDocument()
    expect(screen.getByText('Python 3 / uv')).toBeInTheDocument()
  })

  it('renders runtime tool and workflow catalogs', () => {
    render(
      <RuntimeRequirementsPanel
        enabledTools={['dynamic_echo']}
        payload={{
          generated_at: '2026-04-16T00:00:00Z',
          project_root: '/opt/Agent',
          ready_count: 0,
          missing_count: 0,
          manual_count: 0,
          checks: [],
        }}
        toolCatalog={{
          tools: [
            {
              name: 'dynamic_echo',
              group: 'system',
              label: 'dynamic_echo',
              description: '动态工具',
              source: 'filesystem',
              persistence: 'filesystem',
              human_in_the_loop_only: false,
            },
          ],
        }}
        workflowCatalog={{
          workflows: [
            {
              name: 'dynamic_echo_flow',
              source: 'filesystem',
              persistence: 'filesystem',
              description: '动态 workflow',
            },
          ],
        }}
      />,
    )

    expect(screen.getByText('工具目录')).toBeInTheDocument()
    expect(screen.getByText('Workflow 宿主目录')).toBeInTheDocument()
    expect(screen.getByText('dynamic_echo')).toBeInTheDocument()
    expect(screen.getByText('dynamic_echo_flow')).toBeInTheDocument()
  })
})
