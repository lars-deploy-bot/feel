"use client"

/**
 * AssistantMessage Component
 *
 * Renders Claude's assistant messages from the SDK.
 *
 * IMPORTANT: Tool execution inputs (tool_use blocks) are HIDDEN from regular users.
 * Users only see:
 * - Text responses from Claude
 * - Tool results (via ToolResultMessage component)
 *
 * Tool inputs are only shown in debug mode for developers to inspect what Claude
 * is executing. This keeps the UI clean and focused on results, not process.
 *
 * To enable debug mode: Toggle debug view in settings or use debug store.
 */

import type { SDKAssistantMessage } from "@anthropic-ai/claude-agent-sdk"
import { ChevronRight } from "lucide-react"
import { useState } from "react"
import { OAuthErrorMessage } from "@/components/ui/chat/errors/OAuthErrorMessage"
import { MarkdownDisplay } from "@/components/ui/chat/format/MarkdownDisplay"
import { ToolInputRouter } from "@/components/ui/chat/tools/ToolInputRouter"
import { useDebugVisible } from "@/lib/stores/debug-store"
import { getToolIcon } from "@/lib/tool-icons"
import { hasMarkdown } from "@/lib/utils/markdown-utils"
import type { ContentItem } from "@/types/guards/content"
import { isTextBlock, isToolUseBlock } from "@/types/guards/content"

interface AssistantMessageProps {
  content: SDKAssistantMessage
}

/**
 * Detects OAuth/authentication errors in error messages
 */
function isOAuthError(text: string): boolean {
  return (
    text.includes("authentication_error") &&
    (text.includes("OAuth token has expired") || text.includes("Please run /login"))
  )
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

    // Check for OAuth/authentication errors first
    if (isOAuthError(text)) {
      return <OAuthErrorMessage errorText={text} />
    }

    // Use MarkdownDisplay if the text contains markdown, otherwise render plain text
    if (hasMarkdown(text)) {
      return <MarkdownDisplay content={text} />
    }

    return <div className="whitespace-pre-wrap text-black dark:text-white font-medium leading-relaxed">{text}</div>
  }

  if (isToolUseBlock(item)) {
    // Hide all tool_use blocks in normal mode - users only want to see results
    // In debug mode, show them for inspection
    if (!isDebugMode) {
      return null
    }

    const toolItem = item as { name: string; input: Record<string, unknown> }
    const Icon = getToolIcon(toolItem.name)

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

    const getInlineDetail = (toolName: string, input: Record<string, unknown>) => {
      const name = toolName.toLowerCase()
      if (name === "read" || name === "edit" || name === "write") {
        const filePath = input.file_path as string
        if (filePath) {
          return filePath.split("/").pop() || filePath
        }
      }
      return null
    }

    const inlineDetail = getInlineDetail(toolItem.name, toolItem.input)

    return (
      <DebugToolItem
        toolItem={toolItem}
        icon={Icon}
        actionLabel={getActionLabel(toolItem.name)}
        inlineDetail={inlineDetail}
      />
    )
  }

  // Unhandled content type
  const unhandledItem = item as unknown as { type: string }
  return <div className="text-xs text-red-600 dark:text-red-400">Unhandled content type: {unhandledItem.type}</div>
}

function DebugToolItem({
  toolItem,
  icon: Icon,
  actionLabel,
  inlineDetail,
}: {
  toolItem: { name: string; input: Record<string, unknown> }
  icon: React.ComponentType<{ size: number; className?: string }>
  actionLabel: string
  inlineDetail: string | null
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs font-normal text-black/35 dark:text-white/35 hover:text-black/50 dark:hover:text-white/50 transition-colors"
      >
        <ChevronRight size={12} className={`opacity-60 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
        <Icon size={12} className="opacity-60" />
        <span>{toolItem.name}</span>
        <span className="text-black/25 dark:text-white/25">({actionLabel})</span>
        {inlineDetail && <span className="font-diatype-mono text-black/50 dark:text-white/50">{inlineDetail}</span>}
      </button>

      {isExpanded && (
        <div className="mt-2 ml-6">
          <ToolInputRouter toolName={toolItem.name} input={toolItem.input} />
        </div>
      )}
    </div>
  )
}
