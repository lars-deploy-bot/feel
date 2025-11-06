import type { UIMessage } from "@/features/chat/lib/message-parser"

/**
 * Check if a message is primarily a text message (user message or assistant with only text)
 * Used for grouping messages in the UI
 */
export function isTextMessage(message: UIMessage): boolean {
  // User messages are always text
  if (message.type === "user") return true

  // Assistant messages with only text content (no tools)
  if (message.type === "sdk_message" && message.content?.type === "assistant") {
    const content = message.content.message?.content || []
    return content.length === 1 && content[0]?.type === "text"
  }

  return false
}

/**
 * Check if a message is a completion/result message (terminal state)
 * Used to determine when to flush message grouping
 */
export function isCompletionMessage(message: UIMessage): boolean {
  // Direct result or complete message types
  if (message.type === "complete" || message.type === "result") {
    return true
  }

  // SDK messages with result content (including errors)
  if (message.type === "sdk_message" && message.content?.type === "result") {
    return true
  }

  return false
}
