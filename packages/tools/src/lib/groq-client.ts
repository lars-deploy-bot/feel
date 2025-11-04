import { Groq } from "groq-sdk"

let groqClient: Groq | null = null

export async function getGroqClient(): Promise<Groq> {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_SECRET
    if (!apiKey) {
      throw new Error("GROQ_API_SECRET environment variable is required to use the persona generator")
    }
    groqClient = new Groq({
      apiKey,
    })
  }

  return groqClient
}
