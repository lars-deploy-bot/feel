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
import { getToolActionLabel, getToolDetail } from "@webalive/shared"
import { isStreamClientVisibleTool } from "@webalive/shared/tools"
import { ChevronRight } from "lucide-react"
import { useState } from "react"
import { OAuthErrorMessage } from "@/components/ui/chat/errors/OAuthErrorMessage"
import { MarkdownDisplay } from "@/components/ui/chat/format/MarkdownDisplay"
import { ToolInputRouter } from "@/components/ui/chat/tools/ToolInputRouter"
import { useDebugVisible } from "@/lib/stores/debug-store"
import { getToolIcon } from "@/lib/tool-icons"
import { cn } from "@/lib/utils"
import { hasMarkdown } from "@/lib/utils/markdown-utils"
import type { ContentItem } from "@/types/guards/content"
import { isTextBlock, isToolUseBlock } from "@/types/guards/content"
import { ICON_SIZE, interactiveText, messageText, monoText, mutedIcon, subtleText, toolIndicatorButton } from "./styles"

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
    <>
      {content.message.content.map((item, index) => (
        <ToolUseItem key={index} item={item} />
      ))}
    </>
  )
}

function ToolUseItem({ item }: { item: ContentItem }): React.ReactNode {
  const isDebugMode = useDebugVisible()
  if (isTextBlock(item)) {
    const text = item.text.trim()
    if (!text) return null

    // Check for OAuth/authentication errors first
    if (isOAuthError(text)) {
      return <OAuthErrorMessage />
    }

    // Use MarkdownDisplay if the text contains markdown, otherwise render plain text
    // Text messages get more vertical spacing than tool results
    if (hasMarkdown(text)) {
      return (
        <div>
          <MarkdownDisplay content={text} />
        </div>
      )
    }

    return <div className={messageText}>{text}</div>
  }

  if (isToolUseBlock(item)) {
    if (!isStreamClientVisibleTool(item.name)) {
      return null
    }

    // Hide all tool_use blocks in normal mode - users only want to see results
    // In debug mode, show them for inspection
    if (!isDebugMode) {
      return null
    }

    const Icon = getToolIcon(item.name)
    const actionLabel = getToolActionLabel(item.name)
    const inlineDetail = getToolDetail(item.name, item.input)

    return <DebugToolItem toolItem={item} icon={Icon} actionLabel={actionLabel} inlineDetail={inlineDetail} />
  }

  // Unhandled content type
  const unhandledType = typeof item === "object" && item !== null && "type" in item ? String(item.type) : "unknown"
  return <div className="text-xs text-red-600 dark:text-red-400">Unhandled content type: {unhandledType}</div>
}

function DebugToolItem({
  toolItem,
  icon: Icon,
  actionLabel,
  inlineDetail,
}: {
  toolItem: { name: string; input: unknown }
  icon: React.ComponentType<{ size?: string | number; className?: string }>
  actionLabel: string
  inlineDetail: string | null
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(toolIndicatorButton, interactiveText, "mb-1")}
      >
        <ChevronRight size={ICON_SIZE} className={cn(mutedIcon, "transition-transform", isExpanded && "rotate-90")} />
        <Icon size={ICON_SIZE} className={mutedIcon} />
        <span>{toolItem.name}</span>
        <span className={subtleText}>({actionLabel})</span>
        {inlineDetail && <span className={cn(monoText, "text-black/50 dark:text-white/50")}>{inlineDetail}</span>}
      </button>

      {isExpanded && (
        <div className="mt-2 ml-6 mb-2">
          <ToolInputRouter toolName={toolItem.name} input={toolItem.input} />
        </div>
      )}
    </>
  )
}
