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

// SDK image content block (multimodal)
interface ImageContentBlock {
  type: "image"
  source: {
    type: "base64"
    media_type: string
    data: string
  }
}

// Type guard to check if a content block is a tool result
function isToolResult(content: unknown): content is ToolResultContent {
  return content !== null && typeof content === "object" && (content as any).type === "tool_result"
}

// Type guard to check if a content block is an image
function isImageContent(content: unknown): content is ImageContentBlock {
  return content !== null && typeof content === "object" && (content as any).type === "image"
}

interface ToolResultMessageProps {
  content: SDKUserMessage
  /** Callback to send a message to the chat (for interactive tools like clarification questions) */
  onSubmitAnswer?: (message: string) => void
}

export function ToolResultMessage({ content, onSubmitAnswer }: ToolResultMessageProps) {
  const messageContent = content.message.content

  return (
    <div className="mb-6 min-w-0 max-w-full">
      {Array.isArray(messageContent) &&
        messageContent.map((result: unknown, index: number) => {
          if (isToolResult(result)) {
            return <ToolResult key={index} result={result} onSubmitAnswer={onSubmitAnswer} />
          }
          // Handle SDK image content blocks (base64 multimodal images)
          if (isImageContent(result)) {
            return <ImagePreview key={index} image={result} />
          }
          return null
        })}
    </div>
  )
}

/** Render a base64 image from SDK multimodal content */
function ImagePreview({ image }: { image: ImageContentBlock }) {
  const dataUrl = `data:${image.source.media_type};base64,${image.source.data}`
  return (
    <div className="my-2 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 inline-block">
      <img src={dataUrl} alt="Analysis result" className="max-w-64 max-h-64 object-contain" loading="lazy" />
    </div>
  )
}

function ToolResult({
  result,
  onSubmitAnswer,
}: {
  result: ToolResultContent
  onSubmitAnswer?: (message: string) => void
}) {
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
    <div className="my-0.5 min-w-0">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className={`text-xs font-normal transition-colors flex items-center gap-1.5 max-w-full ${
          result.is_error
            ? "text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            : "text-black/35 dark:text-white/35 hover:text-black/50 dark:hover:text-white/50"
        }`}
      >
        <Icon size={12} className="opacity-60 flex-shrink-0" />
        <span className="truncate">
          {displayPreview}
          {result.is_error && " error"}
        </span>
      </button>
      {isExpanded && (
        <div className="mt-1 max-w-full overflow-hidden">
          <ToolOutputRouter
            toolName={toolName}
            content={displayContent}
            toolInput={result.tool_input}
            onSubmitAnswer={onSubmitAnswer}
          />
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
