/**
 * LLM Verifier — calls Groq directly to semantically verify Claude responses.
 *
 * Instead of brittle string matching, ask a fast LLM: "does this response do X? yes/no"
 * Returns true/false. Throws on any ambiguity — a verifier must never silently pass or fail.
 *
 * Hardened against:
 * - Empty/missing input → throws (never silently returns false)
 * - Rate limits (429) → retries with backoff, throws after exhaustion
 * - API errors → throws (never swallows)
 * - Ambiguous LLM answers → throws (must be clearly "yes" or "no")
 * - Missing env vars → throws at call time
 */

import Groq from "groq-sdk"

const MAX_RETRIES = 3
const RETRY_BASE_MS = 2_000

let client: Groq | null = null

function getClient(): Groq {
  if (!client) {
    const apiKey = process.env.GROQ_API_SECRET
    if (!apiKey) {
      throw new Error("GROQ_API_SECRET required for LLM verifier")
    }
    client = new Groq({ apiKey })
  }
  return client
}

/**
 * Ask Groq to verify a claim about a text. Returns true if "yes", false if "no".
 * Throws on empty input, API failure, rate limits after retries, or ambiguous answers.
 */
export async function llmVerify(text: string, claim: string): Promise<boolean> {
  if (text.trim().length === 0) {
    throw new Error(`llmVerify: text is empty — cannot verify claim: "${claim}"`)
  }
  if (claim.trim().length === 0) {
    throw new Error("llmVerify: claim is empty")
  }

  const groq = getClient()

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "user",
            content: `Given this text:\n\n"${text}"\n\nQuestion: ${claim}\n\nAnswer with exactly "yes" or "no", nothing else.`,
          },
        ],
        max_tokens: 3,
        temperature: 0,
      })

      const answer = (completion.choices[0]?.message?.content ?? "").trim().toLowerCase()

      if (answer.startsWith("yes")) return true
      if (answer.startsWith("no")) return false

      throw new Error(`llmVerify: ambiguous answer "${answer}" for claim: "${claim}"`)
    } catch (err) {
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes("429") || err.message.includes("rate_limit") || err.message.includes("Rate limit"))

      if (isRateLimit && attempt < MAX_RETRIES - 1) {
        const wait = RETRY_BASE_MS * 2 ** attempt
        console.warn(`[llmVerify] Rate limited, retrying in ${wait}ms (${attempt + 1}/${MAX_RETRIES})`)
        await new Promise(resolve => setTimeout(resolve, wait))
        continue
      }

      throw err
    }
  }

  throw new Error(`llmVerify: exhausted ${MAX_RETRIES} retries for claim: "${claim}"`)
}
