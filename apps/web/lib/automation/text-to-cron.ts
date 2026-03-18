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
