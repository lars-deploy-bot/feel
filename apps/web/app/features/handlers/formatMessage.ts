import { gatePrompt } from "@/app/features/handlers/gateResult/gateResult.p"
import { getGroqClient } from "@/lib/clients/groq"
import { isSDKResultMessage } from "@/types/guards/sdk"
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk"

const SAFETY_CHECK_PROMPT = `<instructions>
You are a content moderator for a coding assistant application.

Analyze the user input for inappropriate content:
1. Sexual or explicit content
2. Harassment, hate speech, or abusive language
3. Violent or harmful content
4. Offensive or discriminatory language
5. Inappropriate requests unrelated to coding/development

CRITICAL RULES:
- Respond with ONLY the word "safe" or "unsafe"
- NO explanations, NO reasoning, NO additional text
- If you detect ANY inappropriate content: respond "unsafe"
- If the input is a normal coding/development request: respond "safe"
- Technical terms and normal code-related content are safe
- When in doubt, respond "unsafe"

Examples:
- "Create a login page" → safe
- "Build a user authentication system" → safe
- "Add a dark mode toggle" → safe
- "Fix this bug in my code" → safe
- (sexual content) → unsafe
- (harassment or hate speech) → unsafe
- (violent content) → unsafe

THE ONLY WAY TO RESPOND IS "safe" OR "unsafe". DO NOT RESPOND WITH ANYTHING ELSE. NO EXPLANATIONS, NO REASONING, NO ADDITIONAL TEXT.
</instructions>`

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

  // Use the reusable Groq summarization utility
  const minimizedContent = await summarizeWithGroq(resultMessage.result, gatePrompt)

  // Return the message with the minimized result
  return {
    ...resultMessage,
    result: minimizedContent,
  }
}

/**
 * Summarize/format content using Groq LLM
 *
 * @param input - The content to summarize/format
 * @param systemPrompt - System prompt to guide the summarization
 * @returns Summarized content, or original content if summarization fails
 */
export async function summarizeWithGroq(input: string, systemPrompt: string): Promise<string> {
  try {
    const groq = await getGroqClient()

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: input,
        },
      ],
      model: "openai/gpt-oss-20b",
      temperature: 1,
      max_completion_tokens: 8192,
      top_p: 1,
      reasoning_effort: "low",
      stop: null,
    })

    const summarizedContent = chatCompletion.choices[0]?.message?.content

    return summarizedContent || input
  } catch (error) {
    console.error("[summarizeWithGroq] Groq API error:", error)
    return input
  }
}

/**
 * Check if user input is safe using Groq LLM
 *
 * @param input - The user input to check for malicious patterns
 * @returns "safe" if input is clean, "unsafe" if suspicious patterns detected
 *
 * @example
 * ```ts
 * const safety = await isInputSafe("Create a login page")
 * if (safety === "unsafe") {
 *   throw new Error("Malicious input detected")
 * }
 * ```
 */
export async function isInputSafe(input: string): Promise<"safe" | "unsafe"> {
  try {
    const groq = await getGroqClient()

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: SAFETY_CHECK_PROMPT,
        },
        {
          role: "user",
          content: input,
        },
      ],
      model: "openai/gpt-oss-20b",
      temperature: 0, // Deterministic for consistent security decisions
      max_completion_tokens: 10, // Only need one word
      top_p: 1,
      reasoning_effort: "low",
      stop: null,
    })

    const response = chatCompletion.choices[0]?.message?.content?.trim().toLowerCase()

    // Only return "safe" if response is exactly "safe", otherwise unsafe
    return response === "safe" ? "safe" : ("unsafe" as const)
  } catch (error) {
    console.error("[isInputSafe] Groq API error:", error)
    // Fail-safe: block on error to prevent potential attacks
    return "unsafe"
  }
}
