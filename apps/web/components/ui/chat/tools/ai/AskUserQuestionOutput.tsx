/**
 * AskUserQuestion Output
 *
 * Maps the SDK's built-in AskUserQuestion tool to the existing
 * ClarificationQuestions UI. The SDK tool has questions in toolInput
 * (not in the result), so we read from there.
 */

"use client"

import { useCallback, useState } from "react"
import {
  type ClarificationQuestion,
  ClarificationQuestions,
  type QuestionAnswer,
} from "@/components/ai/ClarificationQuestions"
import type { ToolResultRendererProps } from "@/lib/tools/tool-registry"

/**
 * SDK AskUserQuestion input format
 */
interface SDKQuestion {
  question: string
  header: string
  options: Array<{
    label: string
    description?: string
  }>
  multiSelect: boolean
}

interface AskUserQuestionInput {
  questions: SDKQuestion[]
}

function isAskUserQuestionInput(data: unknown): data is AskUserQuestionInput {
  if (!data || typeof data !== "object") return false
  const d = data as Record<string, unknown>
  if (!Array.isArray(d.questions) || d.questions.length === 0) return false

  for (const q of d.questions) {
    if (typeof q !== "object" || !q) return false
    const question = q as Record<string, unknown>
    if (typeof question.question !== "string") return false
    if (!Array.isArray(question.options) || question.options.length < 2) return false
  }

  return true
}

/**
 * Validate for registry — always true since the component
 * reads questions from toolInput (not from result data).
 * The component itself handles missing/invalid input gracefully.
 */
export function validateAskUserQuestion(): boolean {
  return true
}

function formatAnswersForSubmission(answers: QuestionAnswer[], questions: SDKQuestion[]): string {
  const lines: string[] = []

  for (let i = 0; i < answers.length; i++) {
    const answer = answers[i]
    const question = questions[i]

    let answerText: string
    if (answer.selectedOption === null) {
      answerText = "(skipped)"
    } else if (answer.selectedOption >= question.options.length) {
      answerText = answer.customValue || "(empty custom answer)"
    } else {
      answerText = question.options[answer.selectedOption].label
    }

    lines.push(`**${question.question}**`)
    lines.push(`→ ${answerText}`)
    lines.push("")
  }

  return lines.join("\n")
}

export function AskUserQuestionOutput({ toolInput, onSubmitAnswer }: ToolResultRendererProps) {
  const [submitted, setSubmitted] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const [submittedAnswers, setSubmittedAnswers] = useState<QuestionAnswer[] | null>(null)

  const input = toolInput as AskUserQuestionInput | undefined
  if (!input || !isAskUserQuestionInput(input)) {
    return null
  }

  const sdkQuestions = input.questions

  // Adapt SDK format → ClarificationQuestion format
  const questions: ClarificationQuestion[] = sdkQuestions.map((q, i) => ({
    id: q.header || `q${i}`,
    question: q.question,
    options: q.options.slice(0, 3), // Cap at 3 — ClarificationQuestions reserves index 3 for "Other"
  }))

  const handleComplete = useCallback(
    (answers: QuestionAnswer[]) => {
      setSubmittedAnswers(answers)
      setSubmitted(true)
      const message = formatAnswersForSubmission(answers, sdkQuestions)
      onSubmitAnswer?.(message)
    },
    [sdkQuestions, onSubmitAnswer],
  )

  const handleSkipAll = useCallback(() => {
    setSkipped(true)
    onSubmitAnswer?.("I'd like to skip these questions and let you decide.")
  }, [onSubmitAnswer])

  if (submitted || skipped) {
    return (
      <div className="mt-2 p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
        <p className="text-xs text-black/50 dark:text-white/50">
          {skipped ? "Questions skipped" : "Answers submitted"}
        </p>
        {submittedAnswers && !skipped && (
          <div className="mt-2 space-y-1">
            {submittedAnswers.map((answer, i) => {
              const question = sdkQuestions[i]
              let answerText: string
              if (answer.selectedOption === null) {
                answerText = "(skipped)"
              } else if (answer.selectedOption >= question.options.length) {
                answerText = answer.customValue || "(empty)"
              } else {
                answerText = question.options[answer.selectedOption].label
              }
              return (
                <div key={answer.questionId} className="text-xs">
                  <span className="text-black/40 dark:text-white/40">{i + 1}. </span>
                  <span className="text-black/70 dark:text-white/70">{answerText}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mt-2">
      <ClarificationQuestions questions={questions} onComplete={handleComplete} onSkipAll={handleSkipAll} />
    </div>
  )
}
