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
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`text-[10px] font-thin text-black/30 hover:text-black/50 transition-colors ${getShimmerClass()}`}
      >
        {getStatusText()}
        <span className="ml-1 text-[9px]">{isExpanded ? "−" : "+"}</span>
      </button>

      {isExpanded && (
        <div className="mt-1.5 space-y-1 pl-3 border-l border-black/5">
          {messages.map(message => (
            <div key={message.id} className="text-xs">
              {renderMessage(message)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
