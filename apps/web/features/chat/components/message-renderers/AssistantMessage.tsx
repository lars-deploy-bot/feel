import type { SDKAssistantMessage } from "@anthropic-ai/claude-agent-sdk"
import { MarkdownDisplay } from "@/components/ui/chat/format/MarkdownDisplay"
import { useDebugVisible } from "@/lib/dev-mode-context"
import { getToolIcon } from "@/lib/tool-icons"
import { hasMarkdown } from "@/lib/utils/markdown-utils"
import type { ContentItem } from "@/types/guards/content"
import { isTextBlock, isToolUseBlock } from "@/types/guards/content"

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
  const isDebugMode = useDebugVisible()
  if (isTextBlock(item)) {
    const text = item.text

    // Use MarkdownDisplay if the text contains markdown, otherwise render plain text
    if (hasMarkdown(text)) {
      return <MarkdownDisplay content={text} />
    }

    return <div className="whitespace-pre-wrap text-black font-medium leading-relaxed">{text}</div>
  }

  if (isToolUseBlock(item)) {
    const toolItem = item as { name: string; input: Record<string, unknown> }
    const Icon = getToolIcon(toolItem.name)

    const getActionLabel = (toolName: string) => {
      const friendlyLabel = (() => {
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
      })()

      // In debug mode, show both exact tool name and friendly label
      if (isDebugMode) {
        return `${toolName} (${friendlyLabel})`
      }

      return friendlyLabel
    }

    const getInlineDetail = (toolName: string, input: Record<string, unknown>) => {
      const name = toolName.toLowerCase()
      if (name === "read" || name === "edit" || name === "write") {
        const filePath = input.file_path as string
        if (filePath) {
          const fileName = filePath.split("/").pop() || filePath
          return fileName
        }
      }
      return null
    }

    const inlineDetail = getInlineDetail(toolItem.name, toolItem.input)

    return (
      <div className="my-1 text-xs font-normal text-black/35 flex items-center gap-1.5">
        <Icon size={12} className="opacity-60" />
        <span>{getActionLabel(toolItem.name)}</span>
        {inlineDetail && <span className="font-diatype-mono text-black/50">{inlineDetail}</span>}
      </div>
    )
  }

  // Unhandled content type
  const unhandledItem = item as unknown as { type: string }
  return <div className="text-xs text-red-600">Unhandled content type: {unhandledItem.type}</div>
}
