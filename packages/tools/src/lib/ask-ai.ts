import { getGroqClient } from "./groq-client"

export async function askAI(prompt: string, schema?: string): Promise<string> {
  const groq = await getGroqClient()

  const fullPrompt = schema ? `${prompt}\n\nReturn a JSON object with this structure:\n${schema}` : prompt

  const message = await groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: fullPrompt,
      },
    ],
    model: "mixtral-8x7b-32768",
    temperature: 1,
    max_tokens: 2048,
    response_format: { type: "json_object" },
  })

  const responseText = message.choices[0]?.message?.content
  if (!responseText) {
    throw new Error("No response from Groq - the service may be temporarily unavailable")
  }

  return responseText
}
