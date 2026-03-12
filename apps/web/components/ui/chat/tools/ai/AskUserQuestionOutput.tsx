/**
 * AskUserQuestion Output
 *
 * Thin adapter: maps the SDK's built-in AskUserQuestion toolInput
 * into the format ClarificationQuestionsOutput expects, then delegates.
 * No duplicated logic — ClarificationQuestionsOutput owns the UI.
 */

"use client"

import { CLARIFICATION_OPTIONS_PER_QUESTION } from "@webalive/shared"
import { useMemo } from "react"
import type { ToolResultRendererProps } from "@/lib/tools/tool-registry"
import { ClarificationQuestionsOutput } from "./ClarificationQuestionsOutput"

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

/**
 * Adapt SDK AskUserQuestion input → ClarificationQuestionsData format
 */
function adaptToClarificationData(input: AskUserQuestionInput) {
  return {
    type: "clarification_questions" as const,
    questions: input.questions.map((q, i) => ({
      id: q.header || `q${i}`,
      question: q.question,
      options: q.options.slice(0, CLARIFICATION_OPTIONS_PER_QUESTION),
    })),
  }
}

export function AskUserQuestionOutput(props: ToolResultRendererProps) {
  const input = isAskUserQuestionInput(props.toolInput) ? props.toolInput : null
  const adaptedData = useMemo(() => (input ? adaptToClarificationData(input) : null), [input])

  if (!adaptedData) {
    return null
  }

  return <ClarificationQuestionsOutput {...props} data={adaptedData} />
}
