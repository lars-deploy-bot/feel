/**
 * Collapsible group for consecutive exploration tool results.
 *
 * When Claude reads/searches many files, this collapses them into
 * a card showing "Explored N files" with a completion badge.
 *
 * When a subagent summary is available, expanding shows the summary
 * with a "Show full output" button below to reveal raw tool results.
 */

"use client"

import { truncateMarkdown } from "@webalive/shared"
import { Check, ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import { MarkdownDisplay } from "@/components/ui/chat/format/MarkdownDisplay"
import { getGroupSummary } from "@/features/chat/lib/group-tool-messages"
import type { UIMessage } from "@/features/chat/lib/message-parser"
import { renderMessage } from "@/features/chat/lib/message-renderer"
import type { SDKAssistantMessage } from "@/features/chat/types/sdk-types"
import { cn } from "@/lib/utils"
import { interactiveText, mutedIcon, subtleText, toolIndicatorButton } from "./styles"

interface CollapsibleToolGroupProps {
  messages: UIMessage[]
  /** Optional trailing Task result message (absorbed into group header) */
  trailingTaskResult?: UIMessage | null
  /** Optional subagent assistant text absorbed between group and Task result */
  subagentSummary?: UIMessage | null
  tabId?: string
  onSubmitAnswer?: (message: string) => void
}

/**
 * Extract text content from a subagent assistant summary message.
 * Returns trimmed text or null if no meaningful text found.
 */
function extractSummaryText(summary: UIMessage): string | null {
  const content = summary.content as SDKAssistantMessage
  const items = content?.message?.content
  if (!Array.isArray(items)) return null

  const texts: string[] = []
  for (const item of items) {
    if (item.type === "text" && typeof item.text === "string") {
      const trimmed = item.text.trim()
      if (trimmed) texts.push(trimmed)
    }
  }

  return texts.length > 0 ? texts.join("\n\n") : null
}

export function CollapsibleToolGroup({
  messages,
  trailingTaskResult,
  subagentSummary,
  tabId,
  onSubmitAnswer,
}: CollapsibleToolGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showFull, setShowFull] = useState(false)
  const { total, breakdown } = getGroupSummary(messages)

  const summaryText = subagentSummary ? extractSummaryText(subagentSummary) : null

  // "Read ×8, Grep ×3, Glob ×1"
  const parts = Object.entries(breakdown)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => `${name} \u00d7${count}`)

  return (
    <div className="mb-2 rounded-lg border border-black/[0.06] dark:border-white/[0.08]">
      {/* Header row */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className={cn(toolIndicatorButton, interactiveText, "flex-1 px-3 py-2")}
        >
          <ChevronRight
            size={12}
            className={cn(mutedIcon, "flex-shrink-0 transition-transform", isExpanded && "rotate-90")}
          />
          <span>
            Explored {total} file{total !== 1 ? "s" : ""}
          </span>
          <span className={subtleText}>({parts.join(", ")})</span>
        </button>

        {trailingTaskResult && (
          <span className="flex items-center pr-3 text-emerald-600/60 dark:text-emerald-400/60">
            <Check size={11} strokeWidth={2.5} />
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-black/[0.06] dark:border-white/[0.08]">
          {summaryText ? (
            <>
              {/* Preview — truncated markdown, or full on "Show more" */}
              <div className="px-3 pt-2 pb-1">
                <MarkdownDisplay content={showFull ? summaryText : truncateMarkdown(summaryText, 200)} />
              </div>

              {/* Show more / Show less */}
              <div className="px-3 pb-2">
                <button
                  type="button"
                  onClick={() => setShowFull(!showFull)}
                  className={cn(toolIndicatorButton, interactiveText, "gap-1 px-1.5 py-0.5 rounded")}
                >
                  <ChevronDown size={11} className={cn(mutedIcon, "transition-transform", showFull && "rotate-180")} />
                  <span>{showFull ? "Show less" : "Show more"}</span>
                </button>
              </div>
            </>
          ) : (
            /* No summary — show raw tool results directly */
            <div className="px-3 pt-2 pb-1 space-y-0.5">
              {messages.map(message => (
                <div key={message.id}>{renderMessage(message, { onSubmitAnswer, tabId })}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
