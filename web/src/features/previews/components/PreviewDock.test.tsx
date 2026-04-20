import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PreviewRunResponse } from '../../../shared/api/contracts'
import { PreviewDock } from './PreviewDock'


const PREVIEW_RESPONSE: PreviewRunResponse = {
  artifact: {
    content_type: 'text/html',
    file_name: 'preview.html',
    kind: 'html',
    url: 'https://example.com/preview.html',
  },
  command: null,
  completed_at: '2026-04-17T08:00:10Z',
  created_at: '2026-04-17T08:00:00Z',
  error: null,
  language: 'html',
  mode: 'artifact',
  normalized_language: 'html',
  run_dir: '/tmp/preview',
  run_id: 'preview-run-1',
  session_id: 'session-1',
  source_file: '/tmp/preview/source.html',
  status: 'completed',
  stderr: null,
  terminal: null,
  stdout: null,
  title: 'preview',
}

const TERMINAL_RESPONSE: PreviewRunResponse = {
  artifact: null,
  command: 'python main.py',
  completed_at: null,
  created_at: '2026-04-17T08:00:00Z',
  error: null,
  language: 'python',
  mode: 'terminal',
  normalized_language: 'python',
  run_dir: '/tmp/preview-terminal',
  run_id: 'preview-run-terminal',
  session_id: 'session-1',
  source_file: '/tmp/preview-terminal/main.py',
  status: 'running',
  stderr: null,
  stdout: null,
  terminal: {
    can_write_stdin: true,
    cols: 100,
    exit_code: null,
    rows: 32,
    screen_text: '请输入你的名字:',
    transcript_tail: '请输入你的名字:',
  },
  title: 'terminal-preview',
}

const PYTHON_OUTPUT_RESPONSE: PreviewRunResponse = {
  artifact: null,
  command: 'python main.py',
  completed_at: '2026-04-17T08:00:10Z',
  created_at: '2026-04-17T08:00:00Z',
  error: null,
  language: 'python',
  mode: 'artifact',
  normalized_language: 'python',
  run_dir: '/tmp/python-output',
  run_id: 'preview-run-python-output',
  session_id: 'session-1',
  source_file: '/tmp/python-output/main.py',
  status: 'completed',
  stderr: null,
  terminal: null,
  stdout: 'plain python output',
  title: 'python-output-preview',
}

class ResizeObserverMock {
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element) {
    this.callback(
      [
        {
          borderBoxSize: [] as ResizeObserverSize[],
          contentBoxSize: [] as ResizeObserverSize[],
          contentRect: target.getBoundingClientRect(),
          devicePixelContentBoxSize: [] as ResizeObserverSize[],
          target,
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    )
  }

  unobserve() {}

  disconnect() {}
}

describe('PreviewDock', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      bottom: 420,
      height: 420,
      left: 0,
      right: 600,
      toJSON: () => ({}),
      top: 0,
      width: 600,
      x: 0,
      y: 0,
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('根据比例切换自适应预览画布尺寸', async () => {
    render(
      <PreviewDock
        activeRequest={{
          code: '<main>Hello</main>',
          key: 'preview:key',
          language: 'html',
          sessionId: 'session-1',
        }}
        isRunning={false}
        onClose={() => undefined}
        onRefresh={() => undefined}
        response={PREVIEW_RESPONSE}
      />,
    )

    const canvas = screen.getByTitle('html-preview-preview-run-1').closest('.preview-dock-canvas')
    expect(canvas).not.toBeNull()

    await waitFor(() => {
      expect(canvas).toHaveStyle({
        height: '337px',
        width: '600px',
      })
    })

    fireEvent.click(screen.getByRole('tab', { name: '9:16' }))

    await waitFor(() => {
      expect(canvas).toHaveStyle({
        height: '420px',
        width: '236px',
      })
    })
  })

  it('在代码视图中编辑后自动刷新预览', async () => {
    vi.useFakeTimers()
    const onRunCode = vi.fn()

    render(
      <PreviewDock
        activeRequest={{
          code: '<main>Hello</main>',
          key: 'preview:key',
          language: 'html',
          sessionId: 'session-1',
        }}
        isRunning={false}
        onClose={() => undefined}
        onRefresh={() => undefined}
        onRunCode={onRunCode}
        response={PREVIEW_RESPONSE}
      />,
    )

    fireEvent.click(screen.getByRole('tab', { name: '代码' }))
    fireEvent.change(screen.getByLabelText('预览代码编辑器'), {
      target: {
        value: '<main>Hello Codex</main>',
      },
    })

    await vi.advanceTimersByTimeAsync(820)

    expect(onRunCode).toHaveBeenCalledWith('<main>Hello Codex</main>')

    vi.useRealTimers()
  })

  it('renders preview iframe with same-origin sandbox allowance', () => {
    render(
      <PreviewDock
        activeRequest={{
          code: '<main>Hello</main>',
          key: 'preview:key',
          language: 'html',
          sessionId: 'session-1',
        }}
        isRunning={false}
        onClose={() => undefined}
        onRefresh={() => undefined}
        response={PREVIEW_RESPONSE}
      />,
    )

    expect(screen.getByTitle('html-preview-preview-run-1')).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-same-origin',
    )
  })

  it('renders terminal preview and forwards stdin input', async () => {
    const onSendTerminalInput = vi.fn().mockResolvedValue(undefined)

    render(
      <PreviewDock
        activeRequest={{
          code: 'name = input()',
          key: 'preview:key',
          language: 'python',
          sessionId: 'session-1',
        }}
        isRunning
        onClose={() => undefined}
        onRefresh={() => undefined}
        onSendTerminalInput={onSendTerminalInput}
        response={TERMINAL_RESPONSE}
      />,
    )

    expect(screen.getByText('请输入你的名字:')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('输入内容并回车发送到 stdin...'), {
      target: {
        value: 'Codex',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送回车' }))

    await waitFor(() => {
      expect(onSendTerminalInput).toHaveBeenCalledWith('Codex', true)
    })
  })

  it('在无可视产物时展示 Python 运行输出面板', () => {
    render(
      <PreviewDock
        activeRequest={{
          code: 'print(\"plain python output\")',
          key: 'preview:key',
          language: 'python',
          sessionId: 'session-1',
        }}
        isRunning={false}
        onClose={() => undefined}
        onRefresh={() => undefined}
        response={PYTHON_OUTPUT_RESPONSE}
      />,
    )

    expect(screen.getByText('运行输出')).toBeInTheDocument()
    expect(screen.getByText('plain python output')).toBeInTheDocument()
  })
})
