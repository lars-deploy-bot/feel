/**
 * Shared conversation-source normalization.
 *
 * Used by both server API routes and client-side sync so both sides
 * agree on exactly when a conversation is an automation transcript.
 */

import { isRecord } from "@/lib/utils"

export const CONVERSATION_SOURCES = ["chat", "automation_run"] as const

export type ConversationSource = (typeof CONVERSATION_SOURCES)[number]

/** Typed constant for automation_run source — use instead of inline string literal */
export const AUTOMATION_RUN_SOURCE: ConversationSource = "automation_run"

/** sourceMetadata shape for automation_run conversations */
export interface AutomationSourceMetadata {
  job_id: string
  claim_run_id: string
  triggered_by: string
}

/** Narrow a raw source value to ConversationSource, defaulting to "chat". */
export function normalizeConversationSource(raw: unknown): ConversationSource {
  if (raw === "automation_run") return "automation_run"
  if (raw === "chat") return "chat"
  return "chat"
}

/**
 * Narrow raw metadata to AutomationSourceMetadata when all required fields exist.
 * Returns null for absent/malformed values.
 */
export function narrowAutomationSourceMetadata(raw: unknown): AutomationSourceMetadata | null {
  if (!isRecord(raw)) return null
  if (typeof raw.job_id !== "string" || typeof raw.claim_run_id !== "string" || typeof raw.triggered_by !== "string") {
    return null
  }
  return {
    job_id: raw.job_id,
    claim_run_id: raw.claim_run_id,
    triggered_by: raw.triggered_by,
  }
}

/**
 * Normalize source + metadata as one unit so callers cannot diverge.
 */
export function normalizeConversationSourcePayload(
  rawSource: unknown,
  rawMetadata: unknown,
): {
  source: ConversationSource
  sourceMetadata: AutomationSourceMetadata | null
} {
  const source = normalizeConversationSource(rawSource)
  if (source !== "automation_run") {
    return { source, sourceMetadata: null }
  }
  return {
    source,
    sourceMetadata: narrowAutomationSourceMetadata(rawMetadata),
  }
}
