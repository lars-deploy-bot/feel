import { useState } from "react"
import { UIMessage } from "@/lib/message-parser"
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
    <div className="mb-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`text-xs font-thin text-black/40 hover:text-black/60 transition-colors ${getShimmerClass()}`}
      >
        {getStatusText()}
        <span className="ml-1">{isExpanded ? "−" : "+"}</span>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-1 pl-3 border-l border-black/10">
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
