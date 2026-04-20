import { describe, expect, it } from 'vitest'

import { extractSseFrames, parseSseFrame } from './sse'


describe('sse parser', () => {
  it('can split complete frames and keep the trailing remainder', () => {
    const payload =
      'event: session.started\ndata: {"session_id":"s1","timestamp":"t1"}\n\n' +
      'event: done\ndata: {"session_id":"s1","timestamp":"t2"}\n\n' +
      'event: assistant.step'

    const { frames, remainder } = extractSseFrames(payload)

    expect(frames).toHaveLength(2)
    expect(remainder).toBe('event: assistant.step')
  })

  it('can parse assistant step payloads', () => {
    const frame =
      'event: assistant.step\n' +
      'data: {"session_id":"s1","agent_name":"planner","content":"先读取文件","tool_calls":[{"name":"read_file"}],"turn_usage":{"prompt_tokens":12},"session_usage":{"total_tokens":12},"turn_cost_usd":0.001,"session_cost_usd":0.001,"timestamp":"2026-04-16T00:00:00"}'

    const event = parseSseFrame(frame)

    expect(event).not.toBeNull()
    expect(event?.event).toBe('assistant.step')
    if (event?.event === 'assistant.step') {
      expect(event.data.agent_name).toBe('planner')
      expect(event.data.tool_calls[0]).toEqual({ name: 'read_file' })
      expect(event.data.turn_usage?.prompt_tokens).toBe(12)
    }
  })

  it('can parse session telemetry payloads', () => {
    const frame =
      'event: session.telemetry\n' +
      'data: {"session_id":"s1","metrics":{"turn_usage":{"prompt_tokens":20},"session_usage":{"total_tokens":220},"turn_cost_usd":0.002,"session_cost_usd":0.01,"context_window":{"percent":"8%"},"agent_metrics":[]},"timestamp":"2026-04-16T00:00:01"}'

    const event = parseSseFrame(frame)

    expect(event).not.toBeNull()
    expect(event?.event).toBe('session.telemetry')
    if (event?.event === 'session.telemetry') {
      expect(event.data.metrics.turn_usage.prompt_tokens).toBe(20)
      expect(event.data.metrics.context_window.percent).toBe('8%')
    }
  })

  it('can parse session interrupted payloads', () => {
    const frame =
      'event: session.interrupted\n' +
      'data: {"session_id":"s1","interrupt":{"interrupt_id":"resume-1","type":"approval","payload":{"question":"是否继续？"}},"interrupts":[{"interrupt_id":"resume-1","type":"approval","payload":{"question":"是否继续？"}},{"interrupt_id":"resume-2","type":"user_input","payload":{"question":"补充发布窗口"}}],"metrics":{"turn_usage":{"prompt_tokens":20},"session_usage":{"total_tokens":220},"turn_cost_usd":0.002,"session_cost_usd":0.01,"context_window":{"percent":"8%"},"agent_metrics":[]},"timestamp":"2026-04-16T00:00:02"}'

    const event = parseSseFrame(frame)

    expect(event).not.toBeNull()
    expect(event?.event).toBe('session.interrupted')
    if (event?.event === 'session.interrupted') {
      expect(event.data.interrupt?.interrupt_id).toBe('resume-1')
      expect(event.data.interrupts).toHaveLength(2)
      expect(event.data.interrupts[1].payload.question).toBe('补充发布窗口')
      expect(event.data.metrics?.session_usage.total_tokens).toBe(220)
    }
  })
})
