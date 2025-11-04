import type { UIMessage } from "@/lib/message-parser"
import { isCompletionMessage, isTextMessage } from "@/types/guards/ui"

export interface MessageGroup {
  type: "text" | "thinking"
  messages: UIMessage[]
  isComplete: boolean
}

export function groupMessages(messages: UIMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = []
  let currentThinkingGroup: UIMessage[] = []

  const flushThinkingGroup = (isComplete = false) => {
    if (currentThinkingGroup.length > 0) {
      groups.push({
        type: "thinking",
        messages: [...currentThinkingGroup],
        isComplete,
      })
      currentThinkingGroup = []
    }
  }

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]

    if (isTextMessage(message)) {
      // Flush any pending thinking group as complete (thinking finished)
      flushThinkingGroup(true)

      // Add text message as standalone
      groups.push({
        type: "text",
        messages: [message],
        isComplete: true,
      })
    } else {
      // Add to thinking group
      currentThinkingGroup.push(message)

      // If this is a completion message, flush the group as complete
      if (isCompletionMessage(message)) {
        flushThinkingGroup(true)
      }
    }
  }

  // Flush any remaining thinking group as incomplete
  flushThinkingGroup(false)

  return groups
}
