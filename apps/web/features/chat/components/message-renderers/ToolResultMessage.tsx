/**
 * Tool Result Message Renderer
 *
 * Displays tool results with:
 * - Collapsed preview (from unified registry)
 * - Auto-expand based on tool config
 * - Custom renderers for rich UI
 */

import { useState } from "react"
import { ToolOutputRouter } from "@/components/ui/chat/tools/ToolOutputRouter"
import type { SDKUserMessage } from "@/features/chat/types/sdk-types"
import { useDebugVisible } from "@/lib/stores/debug-store"
import { getToolIcon } from "@/lib/tool-icons"
import { shouldAutoExpand, getToolPreview, transformToolData } from "@/lib/tools/tool-registry"

// Extended tool result type with our added tool_name and tool_input
interface ToolResultContent {
  type: "tool_result"
  tool_use_id: string
  content?: string
  is_error?: boolean
  tool_name?: string // Added by our parser
  tool_input?: unknown // Added by our parser - the original tool input
}

// Type guard to check if a content block is a tool result
function isToolResult(content: any): content is ToolResultContent {
  return content && content.type === "tool_result"
}

interface ToolResultMessageProps {
  content: SDKUserMessage
}

export function ToolResultMessage({ content }: ToolResultMessageProps) {
  const messageContent = content.message.content

  return (
    <div className="mb-6">
      {Array.isArray(messageContent) &&
        messageContent.map((result: unknown, index: number) => {
          if (isToolResult(result)) {
            return <ToolResult key={index} result={result} />
          }
          return null
        })}
    </div>
  )
}

function ToolResult({ result }: { result: ToolResultContent }) {
  const toolName = result.tool_name || "Tool Result"
  const isDebugMode = useDebugVisible()

  // Auto-expand based on tool config (errors always expand)
  const [isExpanded, setIsExpanded] = useState(() => shouldAutoExpand(toolName, result.is_error ?? false))

  const Icon = getToolIcon(toolName)

  // Parse the content to get structured tool output
  const displayContent = parseContent(result.content)

  // Get preview text from unified registry
  const transformedData = transformToolData(toolName, displayContent)
  const preview = getToolPreview(toolName, transformedData, result.tool_input)

  // In debug mode, show both exact tool name and preview
  const displayPreview = isDebugMode ? `${toolName}: ${preview}` : preview

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className={`text-xs font-normal transition-colors flex items-center gap-1.5 ${
          result.is_error
            ? "text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            : "text-black/35 dark:text-white/35 hover:text-black/50 dark:hover:text-white/50"
        }`}
      >
        <Icon size={12} className="opacity-60" />
        <span>
          {displayPreview}
          {result.is_error && " error"}
        </span>
      </button>
      {isExpanded && (
        <div className="mt-1 max-w-full overflow-hidden">
          <ToolOutputRouter toolName={toolName} content={displayContent} toolInput={result.tool_input} />
        </div>
      )}
    </div>
  )
}

/** Parse string content as JSON if possible */
function parseContent(content: unknown): unknown {
  if (typeof content === "string") {
    try {
      return JSON.parse(content)
    } catch {
      return content
    }
  }
  return content
}
