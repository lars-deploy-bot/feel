/**
 * Text-to-cron with in-memory result cache.
 *
 * Wraps @webalive/automation's textToCron with:
 * 1. Groq API key injection from env
 * 2. Normalized result cache — same text never hits Groq twice
 *
 * Cache resets on server restart / deploy.
 */

import { type TextToCronResult, textToCron as textToCronBase } from "@webalive/automation"
import { env } from "../../../config/env"

export type { TextToCronResult }

const cache = new Map<string, TextToCronResult>()

function cacheKey(text: string): string {
  return text.trim().toLowerCase()
}

export async function textToCron(text: string): Promise<TextToCronResult> {
  const key = cacheKey(text)
  const cached = cache.get(key)
  if (cached) return cached

  const result = await textToCronBase(text, env.GROQ_API_SECRET)
  cache.set(key, result)
  return result
}

/** Visible for testing */
export function _clearCache(): void {
  cache.clear()
}

/** Visible for testing */
export function _cacheSize(): number {
  return cache.size
}
