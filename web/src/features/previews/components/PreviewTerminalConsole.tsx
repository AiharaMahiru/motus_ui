import { useEffect, useMemo, useRef, useState } from 'react'

import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'

import '@xterm/xterm/css/xterm.css'

import { useTheme } from '../../../shared/theme/ThemeContext'


type PreviewTerminalConsoleProps = {
  cols: number
  rows: number
  rawOutput?: string | null
  screenText?: string
  onResize?: (cols: number, rows: number) => void
  onSendData?: (data: string) => void
}


export function PreviewTerminalConsole({
  cols,
  rows,
  rawOutput,
  screenText,
  onResize,
  onSendData,
}: PreviewTerminalConsoleProps) {
  const { theme } = useTheme()
  const hostRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<{
    fitAddon?: FitAddon
    instance?: Terminal
    resizeObserver?: ResizeObserver
  } | null>(null)
  const lastOutputRef = useRef('')
  const lastFallbackRef = useRef('')
  const lastResizeRef = useRef('')
  const latestRawOutputRef = useRef(rawOutput ?? '')
  const latestScreenTextRef = useRef(screenText ?? '')
  const dataSubscriptionRef = useRef<{ dispose: () => void } | null>(null)
  const syncDisplayRef = useRef<(() => void) | null>(null)
  const onResizeRef = useRef(onResize)
  const onSendDataRef = useRef(onSendData)
  const [loadFailed, setLoadFailed] = useState(false)
  const isJsdom = useMemo(
    () => typeof window !== 'undefined' && /jsdom/i.test(window.navigator.userAgent),
    [],
  )
  const terminalTheme = useMemo(() => {
    if (theme === 'light') {
      return {
        background: '#f8fafc',
        cursor: '#0f172a',
        foreground: '#0f766e',
        selectionBackground: 'rgba(59, 130, 246, 0.18)',
      }
    }

    if (theme === 'black') {
      return {
        background: '#000000',
        cursor: '#f8fafc',
        foreground: '#dcfce7',
        selectionBackground: 'rgba(56, 189, 248, 0.24)',
      }
    }

    return {
      background: '#020617',
      cursor: '#e2e8f0',
      foreground: '#a7f3d0',
      selectionBackground: 'rgba(59, 130, 246, 0.25)',
    }
  }, [theme])

  useEffect(() => {
    onResizeRef.current = onResize
    onSendDataRef.current = onSendData
  }, [onResize, onSendData])

  useEffect(() => {
    latestRawOutputRef.current = rawOutput ?? ''
    latestScreenTextRef.current = screenText ?? ''
    syncDisplayRef.current?.()
  }, [rawOutput, screenText])

  useEffect(() => {
    if (isJsdom) {
      return undefined
    }

    const mapKeyToSequence = (event: KeyboardEvent) => {
      if (event.ctrlKey && !event.altKey && !event.metaKey) {
        const key = event.key.toLowerCase()
        if (key === 'c') {
          return '\u0003'
        }
        if (key === 'd') {
          return '\u0004'
        }
        if (key === 'l') {
          return '\u000c'
        }
      }

      switch (event.key) {
        case 'ArrowUp':
          return '\u001b[A'
        case 'ArrowDown':
          return '\u001b[B'
        case 'ArrowRight':
          return '\u001b[C'
        case 'ArrowLeft':
          return '\u001b[D'
        case 'Home':
          return '\u001b[H'
        case 'End':
          return '\u001b[F'
        case 'Delete':
          return '\u001b[3~'
        case 'Insert':
          return '\u001b[2~'
        case 'PageUp':
          return '\u001b[5~'
        case 'PageDown':
          return '\u001b[6~'
        default:
          return null
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') &&
        !activeElement.classList.contains('xterm-helper-textarea')
      ) {
        return
      }

      const sequence = mapKeyToSequence(event)
      if (!sequence) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      onSendDataRef.current?.(sequence)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isJsdom])

  useEffect(() => {
    if (isJsdom || !hostRef.current) {
      return undefined
    }
    try {
      const terminal = new Terminal({
        allowProposedApi: false,
        convertEol: true,
        cursorBlink: true,
        cursorStyle: 'block',
        cols,
        rows,
        fontFamily: 'JetBrains Mono, SFMono-Regular, ui-monospace, monospace',
        fontSize: 14,
        lineHeight: 1.3,
        theme: terminalTheme,
      })
      const fitAddon = new FitAddon()
      terminal.loadAddon(fitAddon)
      terminal.open(hostRef.current)
      fitAddon.fit()

      // 终端预览以服务端返回的屏幕快照为准，避免首次挂载时丢失回放。
      const syncDisplay = () => {
        const instance = terminalRef.current?.instance
        if (!instance) {
          return
        }

        const nextScreenText = latestScreenTextRef.current
        const nextRawOutput = latestRawOutputRef.current

        if (nextScreenText) {
          if (nextScreenText === lastFallbackRef.current) {
            return
          }
          instance.clear()
          instance.write(nextScreenText.replace(/\n/g, '\r\n'))
          lastFallbackRef.current = nextScreenText
          lastOutputRef.current = ''
          return
        }

        if (nextRawOutput) {
          if (lastOutputRef.current && nextRawOutput.startsWith(lastOutputRef.current)) {
            instance.write(nextRawOutput.slice(lastOutputRef.current.length))
          } else if (nextRawOutput !== lastOutputRef.current) {
            instance.clear()
            instance.write(nextRawOutput)
          }
          lastOutputRef.current = nextRawOutput
          lastFallbackRef.current = ''
          return
        }

        if (lastFallbackRef.current || lastOutputRef.current) {
          instance.clear()
          lastFallbackRef.current = ''
          lastOutputRef.current = ''
        }
      }

      const syncResize = () => {
        fitAddon.fit()
        const resizeKey = `${terminal.cols}x${terminal.rows}`
        if (resizeKey === lastResizeRef.current) {
          return
        }
        lastResizeRef.current = resizeKey
        onResizeRef.current?.(terminal.cols, terminal.rows)
      }

      const dataSubscription = terminal.onData((data) => {
        onSendDataRef.current?.(data)
      })
      dataSubscriptionRef.current = dataSubscription

      const resizeObserver = new ResizeObserver(() => {
        syncResize()
      })
      resizeObserver.observe(hostRef.current)

      terminalRef.current = {
        fitAddon,
        instance: terminal,
        resizeObserver,
      }
      syncDisplayRef.current = syncDisplay
      setLoadFailed(false)

      syncResize()
      syncDisplay()
    } catch (error) {
      console.error('终端预览初始化失败，已退回纯文本模式。', error)
      setLoadFailed(true)
    }

    return () => {
      syncDisplayRef.current = null
      dataSubscriptionRef.current?.dispose()
      dataSubscriptionRef.current = null
      terminalRef.current?.resizeObserver?.disconnect()
      terminalRef.current?.instance?.dispose()
      terminalRef.current = null
    }
  }, [isJsdom, terminalTheme])

  useEffect(() => {
    if (isJsdom) {
      return
    }

    const terminal = terminalRef.current?.instance
    if (!terminal) {
      return
    }

    if (terminal.cols !== cols || terminal.rows !== rows) {
      terminal.resize(cols, rows)
    }
    syncDisplayRef.current?.()
  }, [cols, isJsdom, rows])

  return (
    <div
      className="preview-terminal-console"
      role="presentation"
      onClick={() => {
        terminalRef.current?.instance?.focus()
      }}
    >
      {!loadFailed ? <div className="preview-terminal-console-host" ref={hostRef} /> : null}
      {isJsdom || loadFailed ? <pre className="preview-terminal-console-fallback">{screenText || rawOutput || ''}</pre> : null}
    </div>
  )
}
