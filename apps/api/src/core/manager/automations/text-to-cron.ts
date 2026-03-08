import { validateCronExpression } from "@webalive/automation"
import { z } from "zod"
import { env } from "../../../config/env"

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
"weekdays at 9:30 amsterdam time" → 30 9 * * 1-5\nEurope/Amsterdam
"every monday and friday at noon" → 0 12 * * 1,5
"every 15 minutes" → */15 * * * *
"first of every month at midnight" → 0 0 1 * *`

interface TextToCronResult {
  cron: string
  timezone: string | null
}

const GROQ_TIMEOUT_MS = 10_000

function validateTimezone(timezone: string | null): string | null {
  if (!timezone) {
    return null
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone })
    return timezone
  } catch {
    throw new Error(`Invalid timezone from LLM: "${timezone}"`)
  }
}

export async function textToCron(text: string): Promise<TextToCronResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS)

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_SECRET}`,
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

  const groqResponse = z
    .object({ choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1) })
    .parse(await response.json())

  const raw = groqResponse.choices[0].message.content.trim()
  const lines = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)

  if (lines.length === 0 || lines.length > 2) {
    throw new Error(`Unexpected scheduler response format: "${raw}"`)
  }

  const cron = lines[0]
  const timezone = validateTimezone(lines[1] ?? null)

  const validation = validateCronExpression(cron, timezone)
  if (!validation.valid) {
    throw new Error(validation.error ?? `Invalid cron expression from LLM: "${cron}"`)
  }

  return { cron, timezone }
}
