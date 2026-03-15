/**
 * PendingToolsIndicator Component
 *
 * Shows currently executing tools with their details.
 * For Bash: shows the command being run
 * For other tools: shows tool name and relevant input
 *
 * Also shows a "Thinking..." indicator when:
 * - Stream is active (busy)
 * - No tools are currently pending
 * This provides immediate feedback when a message is sent.
 *
 * Updates in real-time as tool_progress events arrive.
 */

import { getThinkingPhrase, getToolActionLabel, getToolDetail, SDK_TOOL_LOWER } from "@webalive/shared"
import { isStreamClientVisibleTool } from "@webalive/shared/tools"
import { useEffect, useState } from "react"
import { useVoiceLanguage } from "@/lib/stores/llmStore"
import { type PendingTool, useIsStreamActive, usePendingTools } from "@/lib/stores/streamingStore"
import { cn } from "@/lib/utils"
import { monoText, mutedText } from "./message-renderers/styles"
import { PulsingDot } from "./ui/PulsingDot"

interface PendingToolsIndicatorProps {
  tabId: string | null
  /** When true, hides the "Thinking..." indicator (e.g., during context compaction) */
  suppressThinking?: boolean
}

function getToolLabel(tool: PendingTool): string {
  const input = tool.toolInput
  const lower = tool.toolName.toLowerCase()

  // Bash is special: show the truncated command line
  if (lower === SDK_TOOL_LOWER.BASH) {
    const firstLine = getToolDetail(tool.toolName, input, { bashDetail: "firstLine" })
    if (!firstLine) return tool.toolName
    return firstLine.length > 60 ? `${firstLine.slice(0, 60)}...` : firstLine
  }

  const detail = getToolDetail(tool.toolName, input)
  if (!detail) return tool.toolName

  // File tools show just the filename; others prefix with action verb
  if (lower === SDK_TOOL_LOWER.READ || lower === SDK_TOOL_LOWER.EDIT || lower === SDK_TOOL_LOWER.WRITE) {
    return detail
  }

  return `${getToolActionLabel(tool.toolName)}: ${detail}`
}

function formatElapsedTime(seconds: number): string {
  if (seconds < 1) return ""
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return `${minutes}m ${remainingSeconds}s`
}

function PendingToolItem({ tool }: { tool: PendingTool }) {
  const label = getToolLabel(tool)
  const elapsed = formatElapsedTime(tool.elapsedSeconds)

  // Local timer to show elapsed time even before SDK sends tool_progress
  const [localElapsed, setLocalElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      const secondsSinceStart = Math.floor((Date.now() - tool.startedAt) / 1000)
      setLocalElapsed(secondsSinceStart)
    }, 1000)
    return () => clearInterval(interval)
  }, [tool.startedAt])

  // Use SDK-provided elapsed time if available, otherwise use local timer
  const displayElapsed = tool.elapsedSeconds > 0 ? elapsed : formatElapsedTime(localElapsed)

  return (
    <div className={cn("flex items-center gap-1.5 mb-2 text-xs", mutedText)}>
      <PulsingDot size="sm" />
      <span className={cn(monoText, "truncate max-w-[300px]")}>{label}</span>
      {displayElapsed && (
        <span className="text-black/30 dark:text-white/30 font-mono text-[10px]">{displayElapsed}</span>
      )}
    </div>
  )
}

/**
 * ThinkingIndicator - Shows when stream is active but no tools are running yet
 * Provides immediate feedback when user sends a message
 */
function ThinkingIndicator() {
  const lang = useVoiceLanguage()
  return (
    <div className={cn("flex items-center gap-1.5 mb-2 text-xs", mutedText)} data-testid="thinking-indicator">
      <PulsingDot size="sm" />
      <span>{getThinkingPhrase(lang)}</span>
    </div>
  )
}

export function PendingToolsIndicator({ tabId, suppressThinking }: PendingToolsIndicatorProps) {
  const pendingTools = usePendingTools(tabId)
  const visiblePendingTools = pendingTools.filter(tool => isStreamClientVisibleTool(tool.toolName))
  const isStreamActive = useIsStreamActive(tabId)

  // Show thinking indicator when stream is active but no tools are running
  // (unless suppressed, e.g., during context compaction which has its own indicator)
  if (isStreamActive && visiblePendingTools.length === 0 && !suppressThinking) {
    return <ThinkingIndicator />
  }

  // Show pending tools when they exist
  if (visiblePendingTools.length === 0) {
    return null
  }

  return (
    <div>
      {visiblePendingTools.map(tool => (
        <PendingToolItem key={tool.toolUseId} tool={tool} />
      ))}
    </div>
  )
}
