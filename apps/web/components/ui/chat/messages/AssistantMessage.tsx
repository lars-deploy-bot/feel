import type { SDKAssistantMessage } from "@anthropic-ai/claude-agent-sdk"
import { useState } from "react"
import { ToolInputRouter } from "@/components/ui/chat/tools/ToolInputRouter"
import type { ContentItem } from "@/types/guards/content"
import { isTextBlock, isToolUseBlock } from "@/types/guards/content"
import { MarkdownDisplay } from "@/components/ui/chat/format/MarkdownDisplay"
import { hasMarkdown } from "@/lib/utils/markdown-utils"

interface AssistantMessageProps {
  content: SDKAssistantMessage
}

export function AssistantMessage({ content }: AssistantMessageProps) {
  return (
    <div className="mb-6">
      {content.message.content.map((item, index) => (
        <ToolUseItem key={index} item={item} />
      ))}
    </div>
  )
}

function ToolUseItem({ item }: { item: ContentItem }): React.ReactNode {
  const [isExpanded, setIsExpanded] = useState(false)

  if (isTextBlock(item)) {
    const text = item.text

    // Use MarkdownDisplay if the text contains markdown, otherwise render plain text
    if (hasMarkdown(text)) {
      return <MarkdownDisplay content={text} />
    }

    return <div className="whitespace-pre-wrap text-black font-medium leading-relaxed">{text}</div>
  }

  if (isToolUseBlock(item)) {
    // biome-ignore lint/suspicious/noExplicitAny: Type guard narrowing
    const toolItem = item as any
    const hasInput = toolItem.input && typeof toolItem.input === "object" && Object.keys(toolItem.input).length > 0

    const getActionLabel = (toolName: string) => {
      switch (toolName.toLowerCase()) {
        case "read":
          return "reading"
        case "edit":
          return "editing"
        case "write":
          return "writing"
        case "grep":
          return "searching"
        case "glob":
          return "finding"
        case "bash":
          return "running"
        case "task":
          return "delegating"
        default:
          return toolName.toLowerCase()
      }
    }

    return (
      <div className="mb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-black/40 font-thin hover:text-black/60 transition-colors"
        >
          {getActionLabel(toolItem.name)}
          {hasInput && <span className="ml-1">{isExpanded ? "−" : "+"}</span>}
        </button>
        {hasInput && isExpanded && (
          <div className="mt-1 max-w-full overflow-hidden">
            <ToolInputRouter toolName={toolItem.name} input={toolItem.input as Record<string, string>} />
          </div>
        )}
      </div>
    )
  }

  // Unhandled content type
  const unhandledItem = item as unknown as { type: string }
  return <div className="text-xs text-red-600">Unhandled content type: {unhandledItem.type}</div>
}
