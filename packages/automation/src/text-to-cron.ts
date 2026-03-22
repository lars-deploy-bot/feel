/**
 * Convert natural language schedule text to a cron expression.
 *
 * Uses Groq (Llama 3.3 70B) for conversion, validates the result
 * with croner. Accepts the Groq API key as a parameter so this
 * stays environment-agnostic — both apps/web and apps/api call
 * the same function.
 *
 * SINGLE SOURCE OF TRUTH — do NOT duplicate this in app code.
 */

import { validateCronExpression } from "./scheduler.js"

const SYSTEM_PROMPT = `You convert natural language scheduling descriptions into cron expressions.

Rules:
- Line 1: a valid 5-field cron expression (minute hour day-of-month month day-of-week)
- Line 2: a short human-readable description of what you understood (e.g. "Every weekday at 9:00 AM")
- Line 3 (optional): IANA timezone if the input implies one (e.g. Europe/Amsterdam)
- No seconds field, no year field
- No explanation, no markdown, no quotes
- Use * for "every", */N for intervals, comma-separated for lists

Examples:
"every day at 8am" →
0 8 * * *
Every day at 8:00 AM

"weekdays at 9:30 amsterdam time" →
30 9 * * 1-5
Weekdays at 9:30 AM
Europe/Amsterdam

"evveryday10inmorning" →
0 10 * * *
Every day at 10:00 AM

"every 15 minutes" →
*/15 * * * *
Every 15 minutes

"first of every month at midnight" →
0 0 1 * *
1st of every month at midnight`

export interface TextToCronResult {
  cron: string
  /** What the AI understood from the input, in clean human-readable form */
  description: string
  timezone: string | null
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.3-70b-versatile"
const GROQ_MAX_TOKENS = 80
const GROQ_TIMEOUT_MS = 10_000

function validateTimezone(tz: string | null): string | null {
  if (!tz) return null
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return tz
  } catch {
    throw new Error(`Invalid timezone: "${tz}"`)
  }
}

/**
 * Convert natural language schedule text to a cron expression.
 *
 * @param text - Human-readable schedule like "every weekday at 9am"
 * @param groqApiKey - Groq API key (GROQ_API_SECRET)
 * @returns Parsed cron expression and optional timezone
 */
export async function textToCron(text: string, groqApiKey: string): Promise<TextToCronResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS)

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      temperature: 0,
      max_tokens: GROQ_MAX_TOKENS,
    }),
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeout)
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Groq API error (${response.status}): ${body}`)
  }

  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const raw = json.choices?.[0]?.message?.content?.trim()

  if (!raw) {
    throw new Error("Empty response from schedule parser")
  }

  const lines = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)

  if (lines.length === 0 || lines.length > 3) {
    throw new Error(`Unexpected format: "${raw}"`)
  }

  const cron = lines[0]
  const description = lines[1] ?? cron
  // Timezone is on line 3 if present (line 2 is always the description now)
  const timezone = lines.length === 3 ? validateTimezone(lines[2]) : null

  const validation = validateCronExpression(cron, timezone)
  if (!validation.valid) {
    throw new Error(validation.error ?? `Invalid cron: "${cron}"`)
  }

  return { cron, description, timezone }
}
