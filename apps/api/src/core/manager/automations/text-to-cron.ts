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

export async function textToCron(text: string): Promise<TextToCronResult> {
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
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Groq API error (${response.status}): ${body}`)
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>
  }

  const raw = data.choices[0].message.content.trim()
  const lines = raw.split("\n").filter(l => l.trim().length > 0)

  const cron = lines[0].trim()
  const timezone = lines.length > 1 ? lines[1].trim() : null

  // Basic validation: 5 fields
  const fields = cron.split(/\s+/)
  if (fields.length !== 5) {
    throw new Error(`Invalid cron expression from LLM: "${cron}"`)
  }

  return { cron, timezone }
}
