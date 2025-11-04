import { useState } from "react"
import type { UIMessage } from "@/lib/message-parser"
import { renderMessage } from "@/lib/message-renderer"
import { ThinkingSpinner } from "./ThinkingSpinner"

interface ThinkingGroupProps {
  messages: UIMessage[]
  isComplete: boolean
}

export function ThinkingGroup({ messages, isComplete }: ThinkingGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-xs font-medium text-black/50 hover:text-black/70 transition-colors flex items-center gap-1"
      >
        {!isComplete && <ThinkingSpinner />}
        <span>{isComplete ? "completed" : "thinking"}</span>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-1.5 pl-4 border-l-2 border-black/10">
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
