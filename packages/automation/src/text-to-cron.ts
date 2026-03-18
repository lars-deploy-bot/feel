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
- Output ONLY a valid 5-field cron expression (minute hour day-of-month month day-of-week)
- No seconds field, no year field
- No explanation, no markdown, no quotes — just the cron expression
- Use * for "every", */N for intervals, comma-separated for lists
- If the input also implies a timezone, output it on a second line (IANA format, e.g. Europe/Amsterdam)
- If no timezone is mentioned, output only the cron line

Examples:
"every day at 8am" → 0 8 * * *
"every 2 hours" → 0 */2 * * *
"weekdays at 9:30 amsterdam time" → 30 9 * * 1-5
Europe/Amsterdam
"every monday and friday at noon" → 0 12 * * 1,5
"every 15 minutes" → */15 * * * *
"first of every month at midnight" → 0 0 1 * *`

export interface TextToCronResult {
  cron: string
  timezone: string | null
}

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

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      temperature: 0,
      max_tokens: 50,
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

  if (lines.length === 0 || lines.length > 2) {
    throw new Error(`Unexpected format: "${raw}"`)
  }

  const cron = lines[0]
  const timezone = validateTimezone(lines[1] ?? null)

  const validation = validateCronExpression(cron, timezone)
  if (!validation.valid) {
    throw new Error(validation.error ?? `Invalid cron: "${cron}"`)
  }

  return { cron, timezone }
}
