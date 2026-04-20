import { useEffect, useMemo, useState } from 'react'

import { CheckCircle2, Hand, LoaderCircle, MessageSquareText, ShieldAlert, XCircle } from 'lucide-react'

import type { InterruptInfo } from '../../../shared/api/contracts'
import { useI18n } from '../../../shared/i18n/I18nContext'

type InterruptQuestionOption = {
  label: string
  description?: string
}

type InterruptQuestion = {
  header?: string
  question: string
  options: InterruptQuestionOption[]
}

type InterruptResumeCardProps = {
  interrupt: InterruptInfo
  disabled: boolean
  submitting: boolean
  onSubmit: (interruptId: string, payload: Record<string, unknown>) => void
}

function isApprovalInterrupt(interrupt: InterruptInfo) {
  return interrupt.type === 'approval' || interrupt.type === 'tool_approval'
}

function normalizeQuestions(interrupt: InterruptInfo): InterruptQuestion[] {
  const questions = interrupt.payload.questions
  if (Array.isArray(questions)) {
    const result: InterruptQuestion[] = []
    for (const item of questions) {
      if (!item || typeof item !== 'object') {
        continue
      }
      const record = item as Record<string, unknown>
      const question = typeof record.question === 'string' ? record.question.trim() : ''
      if (!question) {
        continue
      }

      const options: InterruptQuestionOption[] = []
      if (Array.isArray(record.options)) {
        for (const option of record.options) {
          if (!option || typeof option !== 'object') {
            continue
          }
          const optionRecord = option as Record<string, unknown>
          const label = typeof optionRecord.label === 'string' ? optionRecord.label.trim() : ''
          if (!label) {
            continue
          }
          options.push({
            label,
            description: typeof optionRecord.description === 'string' ? optionRecord.description : undefined,
          })
        }
      }

      result.push({
        header: typeof record.header === 'string' ? record.header : undefined,
        question,
        options,
      })
    }
    if (result.length > 0) {
      return result
    }
  }

  const directQuestion =
    typeof interrupt.payload.question === 'string'
      ? interrupt.payload.question.trim()
      : typeof interrupt.payload.message === 'string'
        ? interrupt.payload.message.trim()
        : ''

  if (!directQuestion || isApprovalInterrupt(interrupt)) {
    return []
  }

  return [
    {
      header: undefined,
      question: directQuestion,
      options: [],
    },
  ]
}

function resolveInterruptCopy(
  interrupt: InterruptInfo,
  questions: InterruptQuestion[],
  text: (zh: string, en: string) => string,
) {
  if (questions.length > 0) {
    return {
      headline: questions[0].header || text('等待人工输入', 'Waiting for input'),
      question:
        questions.length === 1
          ? questions[0].question
          : text(`当前中断包含 ${questions.length} 个问题，请逐项作答后继续。`, `This interrupt includes ${questions.length} questions. Please answer them before resuming.`),
      questionCount: questions.length,
    }
  }

  const directQuestion =
    typeof interrupt.payload.question === 'string'
      ? interrupt.payload.question
      : typeof interrupt.payload.message === 'string'
        ? interrupt.payload.message
        : ''

  if (isApprovalInterrupt(interrupt)) {
    return {
      headline: text('危险操作审批', 'Sensitive action approval'),
      question: directQuestion || text('本轮执行需要你的批准后才能继续。', 'This run needs your approval before it can continue.'),
      questionCount: 0,
    }
  }

  return {
    headline: text('等待人工输入', 'Waiting for input'),
    question: directQuestion || text('当前步骤需要人工补充信息后才能继续。', 'This step needs more human input before it can continue.'),
    questionCount: 0,
  }
}

function buildInitialAnswers(questions: InterruptQuestion[]) {
  return Object.fromEntries(questions.map((question) => [question.question, ''])) as Record<string, string>
}

export function InterruptResumeCard({
  interrupt,
  disabled,
  submitting,
  onSubmit,
}: InterruptResumeCardProps) {
  const { text } = useI18n()
  const questions = useMemo(() => normalizeQuestions(interrupt), [interrupt])
  const copy = useMemo(() => resolveInterruptCopy(interrupt, questions, text), [interrupt, questions, text])
  const questionSignature = useMemo(
    () => questions.map((question) => `${question.header ?? ''}:${question.question}`).join('||'),
    [questions],
  )
  const [answers, setAnswers] = useState<Record<string, string>>(() => buildInitialAnswers(questions))
  const [approvalNote, setApprovalNote] = useState('')
  const showApprovalActions = isApprovalInterrupt(interrupt) && questions.length === 0

  useEffect(() => {
    setAnswers(buildInitialAnswers(questions))
    setApprovalNote('')
  }, [interrupt.interrupt_id, questionSignature])

  const canSubmitQuestions =
    questions.length > 0 &&
    questions.every((question) => {
      const value = answers[question.question]
      return typeof value === 'string' && value.trim().length > 0
    })

  function handleAnswerChange(questionText: string, value: string) {
    setAnswers((current) => ({
      ...current,
      [questionText]: value,
    }))
  }

  function handleQuestionSubmit() {
    const payload = Object.fromEntries(
      questions.map((question) => [question.question, (answers[question.question] ?? '').trim()]),
    )
    onSubmit(interrupt.interrupt_id, {
      answers: payload,
    })
  }

  function handleApprovalSubmit(approved: boolean) {
    const trimmedNote = approvalNote.trim()
    onSubmit(interrupt.interrupt_id, {
      approved,
      note: trimmedNote || undefined,
    })
  }

  return (
    <section className="interrupt-card" data-testid="interrupt-card">
      <div className="interrupt-card-header">
        <div className="interrupt-card-copy">
          <span className="interrupt-card-kicker">
            <ShieldAlert size={14} />
            {text('HITL 中断', 'HITL interrupt')}
          </span>
          <h4 className="interrupt-card-title">{copy.headline}</h4>
          <p className="interrupt-card-question">{copy.question}</p>
          {copy.questionCount > 1 ? (
            <p className="interrupt-card-hint">{text('恢复请求会按官方语义提交为 `value.answers` 映射。', 'Resume requests are submitted as a `value.answers` mapping.')}</p>
          ) : null}
        </div>
        <div className="interrupt-card-badge">
          <Hand size={13} />
          <span>{interrupt.type}</span>
        </div>
      </div>

      {questions.length > 0 ? (
        <div className="interrupt-card-question-list">
          {questions.map((question, index) => (
            <div className="interrupt-card-question-item" key={`${interrupt.interrupt_id}:${question.question}:${index}`}>
              <div className="interrupt-card-question-meta">
                <span className="interrupt-card-question-index">{index + 1}</span>
                <div className="interrupt-card-question-copy">
                  {question.header ? <span className="interrupt-card-question-header">{question.header}</span> : null}
                  <p className="interrupt-card-question-text">{question.question}</p>
                </div>
              </div>
              {question.options.length ? (
                <div className="interrupt-card-options">
                  {question.options.map((option) => {
                    const selected = answers[question.question] === option.label
                    return (
                      <button
                        className={selected ? 'interrupt-card-option interrupt-card-option-selected' : 'interrupt-card-option'}
                        disabled={disabled}
                        key={option.label}
                        type="button"
                        onClick={() => handleAnswerChange(question.question, option.label)}
                      >
                        <span className="interrupt-card-option-title">{option.label}</span>
                        {option.description ? <span className="interrupt-card-option-meta">{option.description}</span> : null}
                      </button>
                    )
                  })}
                </div>
              ) : null}
              <div className="interrupt-card-input-row">
                <div className="interrupt-card-input-shell">
                  <MessageSquareText size={14} className="interrupt-card-input-icon" />
                  <input
                    className="interrupt-card-input"
                    data-testid="interrupt-answer-input"
                    disabled={disabled}
                    placeholder={question.options.length ? text('可直接输入自定义答案', 'You can enter a custom answer') : text('输入你的回复', 'Type your reply')}
                    value={answers[question.question] ?? ''}
                    onChange={(event) => handleAnswerChange(question.question, event.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
          <div className="interrupt-card-actions">
            <button
              className="interrupt-card-button interrupt-card-button-primary"
              data-testid="interrupt-submit-button"
              disabled={disabled || !canSubmitQuestions}
              type="button"
              onClick={handleQuestionSubmit}
            >
              {submitting ? <LoaderCircle className="animate-spin" size={13} /> : <CheckCircle2 size={13} />}
              <span>{submitting ? text('提交中', 'Submitting') : text('提交回复', 'Submit reply')}</span>
            </button>
          </div>
        </div>
      ) : null}

      {showApprovalActions ? (
        <div className="interrupt-card-input-row">
          <div className="interrupt-card-input-shell">
            <MessageSquareText size={14} className="interrupt-card-input-icon" />
            <input
              className="interrupt-card-input"
              data-testid="interrupt-approval-note-input"
              disabled={disabled}
              placeholder={text('可选：补充批准原因或限制条件', 'Optional: add approval notes or constraints')}
              value={approvalNote}
              onChange={(event) => setApprovalNote(event.target.value)}
            />
          </div>

          <div className="interrupt-card-actions">
            <button
              className="interrupt-card-button interrupt-card-button-secondary"
              data-testid="interrupt-reject-button"
              disabled={disabled}
              type="button"
              onClick={() => handleApprovalSubmit(false)}
            >
              <XCircle size={13} />
              <span>{text('拒绝', 'Reject')}</span>
            </button>
            <button
              className="interrupt-card-button interrupt-card-button-primary"
              data-testid="interrupt-approve-button"
              disabled={disabled}
              type="button"
              onClick={() => handleApprovalSubmit(true)}
            >
              {submitting ? <LoaderCircle className="animate-spin" size={13} /> : <CheckCircle2 size={13} />}
              <span>{submitting ? text('提交中', 'Submitting') : text('批准并继续', 'Approve and continue')}</span>
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
