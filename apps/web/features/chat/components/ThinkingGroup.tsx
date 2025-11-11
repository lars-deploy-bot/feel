import { useState } from "react"
import { useDebugVisible } from "@/lib/stores/debug-store"
import type { UIMessage } from "../lib/message-parser"
import { getMessageComponentType } from "../lib/message-parser"
import { renderMessage } from "../lib/message-renderer"
import { ThinkingSpinner } from "./ThinkingSpinner"

interface ThinkingGroupProps {
  messages: UIMessage[]
  isComplete: boolean
}

// Check if a message will actually render visible content
function isMessageVisible(message: UIMessage, isDebugMode: boolean): boolean {
  const componentType = getMessageComponentType(message)

  // CompleteMessage never shows
  if (componentType === "complete") {
    return false
  }

  // ResultMessage only shows in debug mode (unless it's an error)
  if (componentType === "result") {
    const content = message.content as any
    if (content.is_error) {
      return true // Errors always show
    }
    return isDebugMode
  }

  // All other message types are visible
  return true
}

export function ThinkingGroup({ messages, isComplete }: ThinkingGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isDebugMode = useDebugVisible()

  // Filter to only visible messages
  const visibleMessages = messages.filter(message => isMessageVisible(message, isDebugMode))

  // Don't show empty thinking groups
  if (visibleMessages.length === 0) {
    return null
  }

  // If complete and not showing debug wrapper, render messages directly (no "doing some work")
  if (isComplete && !isDebugMode) {
    return (
      <>
        {visibleMessages.map(message => (
          <div key={message.id}>{renderMessage(message)}</div>
        ))}
      </>
    )
  }

  // In progress or showing debug: show with wrapper
  return (
    <div className="my-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`text-xs font-normal flex items-center gap-1 group ${
          isDebugMode ? "cursor-pointer" : "cursor-default"
        }`}
      >
        {!isComplete && <ThinkingSpinner />}
        <span className="text-black/35 dark:text-white/35 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-black/35 group-hover:via-black/60 group-hover:to-black/35 dark:group-hover:from-white/35 dark:group-hover:via-white/60 dark:group-hover:to-white/35 group-hover:bg-[length:200%_100%] group-hover:bg-clip-text group-hover:animate-shimmer transition-colors">
          {isComplete ? "thought" : "thinking"}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-1.5 pl-4 border-l-2 border-black/10 dark:border-white/10">
          {visibleMessages.map(message => (
            <div key={message.id} className="text-sm">
              {renderMessage(message)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
