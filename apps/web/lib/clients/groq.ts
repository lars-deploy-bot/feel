import { Groq } from "groq-sdk"

let groqClient: Groq | null = null

/**
 * Get Groq client instance (server-only)
 * Initializes client lazily on first call
 */
export async function getGroqClient(): Promise<Groq> {
  if (!groqClient) {
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_SECRET,
    })
  }

  return groqClient
}
