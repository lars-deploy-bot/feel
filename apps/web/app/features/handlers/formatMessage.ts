import type { SDKMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk"
import { isSDKResultMessage } from "@/types/guards/sdk"
import { getGroqClient } from "@/lib/clients/groq"
import { gatePrompt } from "@/app/features/handlers/gateResult/gateResult.p"

/**
 * Formats/minimizes message content using Groq LLM for 'result' type messages
 */
export async function formatMessage(message: SDKMessage): Promise<SDKMessage> {
  // Only process 'result' type messages
  if (!isSDKResultMessage(message)) {
    return message
  }

  // Access the result field which contains the text to minimize
  const resultMessage = message

  // Skip if no result text or if it's an error or if it's not a success subtype
  if (resultMessage.subtype !== "success") {
    return message
  }

  try {
    // Get Groq client (server-only)
    const groq = await getGroqClient()

    // Make call to Groq to minimize the content
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: gatePrompt,
        },
        {
          role: "user",
          content: resultMessage.result,
        },
      ],
      model: "openai/gpt-oss-20b",
      temperature: 1,
      max_completion_tokens: 8192,
      top_p: 1,
      reasoning_effort: "low",
      stop: null,
    })

    // Extract the minimized content
    const minimizedContent = chatCompletion.choices[0]?.message?.content

    // Return the message with the minimized result
    return {
      ...resultMessage,
      result: minimizedContent || resultMessage.result,
    }
  } catch (error) {
    console.error("[formatMessage] Groq API error:", error)
    // Return original message on error
    return message
  }
}
