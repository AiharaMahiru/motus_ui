import { describe, expect, it } from 'vitest'

import {
  applyHitlApprovalPreset,
  applyHitlQuestionPreset,
  DEFAULT_ENABLED_TOOLS,
  DEFAULT_SESSION_DRAFT,
  buildSessionCreatePayload,
  buildSessionUpdatePayload,
  ensureHitlDraftSafety,
} from './constants'


describe('buildSessionCreatePayload', () => {
  it('can convert the draft into backend payload', () => {
    const payload = buildSessionCreatePayload(DEFAULT_SESSION_DRAFT)

    expect(payload.max_steps).toBe(1024)
    expect(payload.timeout_seconds).toBe(600)
    expect(payload.enabled_tools).toContain('read_file')
    expect(payload.enabled_tools).toHaveLength(DEFAULT_ENABLED_TOOLS.length)
    expect(payload.provider).toBe('openai')
    expect(payload.model_client?.mode).toBe('inherit')
    expect(payload.cache_policy).toBe('auto')
    expect(payload.sandbox.provider).toBe('local')
    expect(payload.memory.type).toBe('compact')
    expect(payload.multi_agent.supervisor_name).toBe('assistant')
  })

  it('can convert the draft into update payload', () => {
    const payload = buildSessionUpdatePayload(DEFAULT_SESSION_DRAFT)

    expect(payload.model_name).toBe('gpt-5.4')
    expect(payload.provider).toBe('openai')
    expect(payload.model_client?.mode).toBe('inherit')
    expect(payload.enabled_tools).toHaveLength(DEFAULT_ENABLED_TOOLS.length)
  })

  it('rejects incomplete guardrail drafts before sending to backend', () => {
    expect(() =>
      buildSessionCreatePayload({
        ...DEFAULT_SESSION_DRAFT,
        inputGuardrails: [
          {
            kind: 'deny_regex',
            message: '',
            pattern: '',
            replacement: '',
            max_length: null,
            ignore_case: false,
            multiline: false,
            dotall: false,
          },
        ],
      }),
    ).toThrow(/input_guardrails\[0\] 缺少 pattern/)
  })

  it('removes HITL-only tools when human_in_the_loop is disabled', () => {
    const payload = buildSessionCreatePayload(
      ensureHitlDraftSafety({
        ...DEFAULT_SESSION_DRAFT,
        humanInTheLoop: false,
        enabledTools: [...DEFAULT_ENABLED_TOOLS, 'ask_user_question'],
      }),
    )

    expect(payload.enabled_tools).not.toContain('ask_user_question')
  })

  it('can apply question and approval HITL presets', () => {
    const questionDraft = applyHitlQuestionPreset(DEFAULT_SESSION_DRAFT)
    const approvalDraft = applyHitlApprovalPreset(DEFAULT_SESSION_DRAFT)

    expect(questionDraft.humanInTheLoop).toBe(true)
    expect(questionDraft.enabledTools).toEqual(['ask_user_question'])
    expect(approvalDraft.humanInTheLoop).toBe(true)
    expect(approvalDraft.enabledTools).toEqual(['bash'])
    expect(approvalDraft.approvalToolNames).toEqual(['bash'])
  })
})
