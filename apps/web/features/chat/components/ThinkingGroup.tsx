import { useState } from "react"
import { useDebugVisible } from "@/lib/stores/debug-store"
import type { UIMessage } from "../lib/message-parser"
import { renderMessage } from "../lib/message-renderer"
import { ThinkingSpinner } from "./ThinkingSpinner"

interface ThinkingGroupProps {
  messages: UIMessage[]
  isComplete: boolean
}

export function ThinkingGroup({ messages, isComplete }: ThinkingGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isDebugMode = useDebugVisible()

  // If complete and not showing debug wrapper, render messages directly (no "doing some work")
  if (isComplete && !isDebugMode) {
    return (
      <>
        {messages.map(message => (
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
        className="text-xs font-normal text-black/35 dark:text-white/35 hover:text-black/50 dark:hover:text-white/50 transition-colors flex items-center gap-1"
      >
        {!isComplete && <ThinkingSpinner />}
        <span>{isComplete ? "doing some work" : "thinking"}</span>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-1.5 pl-4 border-l-2 border-black/10 dark:border-white/10">
          {messages.map(message => (
            <div key={message.id} className="text-sm">
              {renderMessage(message)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
