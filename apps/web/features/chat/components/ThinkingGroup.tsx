/**
 * Thinking Group Component
 *
 * Groups and displays thinking-phase messages:
 * - Tool results: Render directly with their own expand/collapse
 * - Thinking content: Wrapped in collapsible "thought" label
 * - Spinner shown while streaming (unless tools are pending - PendingToolsIndicator handles that)
 */

import { useState } from "react"
import { useDexieCurrentConversationId } from "@/lib/db/dexieMessageStore"
import { useDebugVisible } from "@/lib/stores/debug-store"
import { usePendingTools } from "@/lib/stores/streamingStore"
import { getThinkingContent, getToolResults } from "../lib/message-classifier"
import type { UIMessage } from "../lib/message-parser"
import { renderMessage } from "../lib/message-renderer"
import { ThinkingSpinner } from "./ThinkingSpinner"

interface ThinkingGroupProps {
  messages: UIMessage[]
  isComplete: boolean
  /** Callback to send a message to the chat (for interactive tools like clarification questions) */
  onSubmitAnswer?: (message: string) => void
}

export function ThinkingGroup({ messages, isComplete, onSubmitAnswer }: ThinkingGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isDebugMode = useDebugVisible()
  const conversationId = useDexieCurrentConversationId()
  const pendingTools = usePendingTools(conversationId)

  // Separate tool results (render directly) from thinking content (in wrapper)
  const toolResults = getToolResults(messages)
  const thinkingContent = getThinkingContent(messages, isDebugMode)

  // Don't show "thinking" spinner if tools are pending - PendingToolsIndicator shows those
  const hasPendingTools = pendingTools.length > 0

  // Nothing to show (also skip if only pending tools - let PendingToolsIndicator handle it)
  if (toolResults.length === 0 && thinkingContent.length === 0 && (isComplete || hasPendingTools)) {
    return null
  }

  return (
    <div className="my-4">
      {/* Tool results render directly with their own expand/collapse */}
      {toolResults.map(message => (
        <div key={message.id}>{renderMessage(message, { onSubmitAnswer })}</div>
      ))}

      {/* Thinking wrapper: shown while streaming OR if there's thinking content */}
      {/* Skip when tools are pending - PendingToolsIndicator handles that */}
      {(thinkingContent.length > 0 || (!isComplete && !hasPendingTools)) && (
        <>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-normal flex items-center gap-1 group cursor-pointer"
            data-testid={isComplete ? "thought-indicator" : "thinking-indicator"}
          >
            {!isComplete && !hasPendingTools && <ThinkingSpinner />}
            <span className="text-black/35 dark:text-white/35 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-black/35 group-hover:via-black/60 group-hover:to-black/35 dark:group-hover:from-white/35 dark:group-hover:via-white/60 dark:group-hover:to-white/35 group-hover:bg-[length:200%_100%] group-hover:bg-clip-text group-hover:animate-shimmer transition-colors">
              {isComplete ? "thought" : "thinking"}
            </span>
            {isDebugMode && thinkingContent.length > 0 && (
              <span className="text-black/20 dark:text-white/20 text-[10px]">({thinkingContent.length})</span>
            )}
          </button>

          {isExpanded && thinkingContent.length > 0 && (
            <div className="mt-2 space-y-1.5 pl-4 border-l-2 border-black/10 dark:border-white/10">
              {thinkingContent.map(message => (
                <div key={message.id} className="text-sm">
                  {renderMessage(message, { onSubmitAnswer })}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
