/**
 * Re-export from @webalive/automation — SINGLE SOURCE OF TRUTH.
 *
 * This thin wrapper provides the Groq API key from the environment.
 * The actual text-to-cron logic lives in packages/automation.
 */

import { type TextToCronResult, textToCron as textToCronBase } from "@webalive/automation"
import { env } from "../../../config/env"

export type { TextToCronResult }

export async function textToCron(text: string): Promise<TextToCronResult> {
  return textToCronBase(text, env.GROQ_API_SECRET)
}
