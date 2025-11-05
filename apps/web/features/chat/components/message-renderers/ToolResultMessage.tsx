import { useState } from "react"
import { ToolOutputRouter } from "@/components/ui/chat/tools/ToolOutputRouter"
import type { SDKUserMessage } from "@/features/chat/types/sdk-types"
import { useDebugVisible } from "@/lib/stores/debug-store"
import { getToolIcon } from "@/lib/tool-icons"

// Extended tool result type with our added tool_name
interface ToolResultContent {
  type: "tool_result"
  tool_use_id: string
  content?: string
  is_error?: boolean
  tool_name?: string // Added by our parser
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
        messageContent.map((result: any, index: number) => {
          if (isToolResult(result)) {
            return <ToolResult key={index} result={result} />
          }
          return null
        })}
    </div>
  )
}

function ToolResult({ result }: { result: ToolResultContent }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isDebugMode = useDebugVisible()

  // Use the tool name that was attached by the message parser
  const toolName = result.tool_name || "Tool Result"
  const Icon = getToolIcon(toolName)

  // Parse the content to get structured tool output if it's JSON
  const getDisplayContent = () => {
    if (typeof result.content === "string") {
      try {
        return JSON.parse(result.content)
      } catch {
        return result.content
      }
    }
    return result.content
  }

  const displayContent = getDisplayContent()

  // Format tool output preview (collapsed state)
  const formatToolOutputPreview = (toolName: string, content: any): string => {
    const tool = toolName.toLowerCase()
    let preview = ""

    try {
      switch (tool) {
        case "read":
          if (content.total_lines) preview = `read ${content.lines_returned || content.total_lines} lines`
          else if (content.file_size) preview = "read image"
          else if (content.total_pages) preview = "read pdf"
          else if (content.cells) preview = "read notebook"
          break
        case "write":
          if (content.bytes_written) preview = "wrote file"
          break
        case "edit":
          if (content.replacements !== undefined) preview = `made ${content.replacements} changes`
          break
        case "grep":
          if (content.count !== undefined) preview = `found ${content.count} files`
          else if (content.total_matches !== undefined) preview = `found ${content.total_matches} matches`
          else if (content.total !== undefined) preview = `found ${content.total} matches`
          break
        case "glob":
          if (content.count !== undefined) preview = `found ${content.count} files`
          break
        case "bash":
          if (content.exitCode !== undefined)
            preview = content.exitCode === 0 ? "completed" : `failed (${content.exitCode})`
          break
        case "task":
          preview = "completed"
          break
      }
    } catch (_e) {
      // Fall through
    }

    if (!preview) {
      preview = toolName.toLowerCase()
    }

    // In debug mode, show both exact tool name and preview
    if (isDebugMode) {
      return `${toolName}: ${preview}`
    }

    return preview
  }

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`text-xs font-normal transition-colors flex items-center gap-1.5 ${
          result.is_error
            ? "text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            : "text-black/35 dark:text-white/35 hover:text-black/50 dark:hover:text-white/50"
        }`}
      >
        <Icon size={12} className="opacity-60" />
        <span>
          {formatToolOutputPreview(toolName, displayContent)}
          {result.is_error && " error"}
        </span>
      </button>
      {isExpanded && (
        <div className="mt-1 max-w-full overflow-hidden">
          <ToolOutputRouter toolName={toolName} content={displayContent} />
        </div>
      )}
    </div>
  )
}
