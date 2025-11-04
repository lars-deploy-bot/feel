import { useState } from "react"
import type { UIMessage } from "@/lib/message-parser"
import { renderMessage } from "@/lib/message-renderer"

interface ThinkingGroupProps {
  messages: UIMessage[]
  isComplete: boolean
}

export function ThinkingGroup({ messages, isComplete }: ThinkingGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const getStatusText = () => {
    if (isComplete) return "completed"
    return "thinking"
  }

  const getShimmerClass = () => {
    if (isComplete) return ""
    return "animate-pulse"
  }

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`text-xs font-medium text-black/50 hover:text-black/70 transition-colors ${getShimmerClass()}`}
      >
        {getStatusText()}
        <span className="ml-1.5 text-xs">{isExpanded ? "−" : "+"}</span>
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
