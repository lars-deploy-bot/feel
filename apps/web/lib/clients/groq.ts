import { Groq } from "groq-sdk"

let groqClient: Groq | null = null

/**
 * Get Groq client instance (server-only)
 * Initializes client lazily on first call
 */
export async function getGroqClient(): Promise<Groq> {
  if (!groqClient) {
    if (!process.env.GROQ_API_SECRET) {
      throw new Error("GROQ_API_SECRET environment variable is required")
    }
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_SECRET,
    })
  }

  return groqClient
}
