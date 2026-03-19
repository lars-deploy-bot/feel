/**
 * Re-export from @webalive/automation — SINGLE SOURCE OF TRUTH.
 *
 * This thin wrapper provides the Groq API key from the environment.
 * The actual text-to-cron logic lives in packages/automation.
 */

import { type TextToCronResult, textToCron as textToCronBase } from "@webalive/automation"

export type { TextToCronResult }

export async function textToCron(text: string): Promise<TextToCronResult> {
  const apiKey = process.env.GROQ_API_SECRET
  if (!apiKey) {
    throw new Error("GROQ_API_SECRET environment variable is required")
  }
  return textToCronBase(text, apiKey)
}

/**
 * Resolve schedule_text → cron expression, respecting timezone priority:
 * user's explicit timezone wins over Groq-inferred timezone.
 *
 * Used by both create and update routes to avoid duplicating this logic.
 */
export async function resolveScheduleText(
  scheduleText: string,
  userTimezone: string | null,
): Promise<{ cron: string; timezone: string | null }> {
  const result = await textToCron(scheduleText)
  // User's explicit timezone takes priority over Groq-inferred one
  const timezone = userTimezone ?? result.timezone
  return { cron: result.cron, timezone }
}
