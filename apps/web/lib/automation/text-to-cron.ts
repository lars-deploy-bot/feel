/**
 * Text-to-cron via apps/api.
 *
 * All Groq calls, caching, and rate limiting live in apps/api.
 * This is a thin proxy that calls the API endpoint.
 */

import { apiClient } from "@/lib/api-client"

interface TextToCronResponse {
  ok: true
  data: { cron: string; description: string; timezone: string | null }
}

export interface TextToCronResult {
  cron: string
  description: string
  timezone: string | null
}

export async function textToCron(text: string, userId: string): Promise<TextToCronResult> {
  const response = await apiClient.post<TextToCronResponse>("/manager/automations/text-to-cron", {
    text,
    user_id: userId,
  })
  return response.data
}

/**
 * Resolve schedule_text → cron expression, respecting timezone priority:
 * user's explicit timezone wins over Groq-inferred timezone.
 *
 * Used by both create and update routes.
 */
export async function resolveScheduleText(
  scheduleText: string,
  userTimezone: string | null,
  userId: string,
): Promise<{ cron: string; timezone: string | null }> {
  const result = await textToCron(scheduleText, userId)
  const timezone = userTimezone ?? result.timezone
  return { cron: result.cron, timezone }
}
