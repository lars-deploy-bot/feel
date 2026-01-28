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

import { useEffect, useState } from "react"
import { Terminal, FileText, Search, Edit3, FolderOpen, Cpu, Sparkles } from "lucide-react"
import { type PendingTool, usePendingTools, useIsStreamActive } from "@/lib/stores/streamingStore"
import { cn } from "@/lib/utils"
import { ICON_SIZE, monoText, mutedIcon, mutedText } from "./message-renderers/styles"

interface PendingToolsIndicatorProps {
  tabId: string | null
}

function getToolIcon(toolName: string) {
  const name = toolName.toLowerCase()
  if (name === "bash") return Terminal
  if (name === "read") return FileText
  if (name === "grep") return Search
  if (name === "edit" || name === "write") return Edit3
  if (name === "glob") return FolderOpen
  return Cpu
}

function getToolLabel(tool: PendingTool): string {
  const name = tool.toolName.toLowerCase()
  const input = tool.toolInput as Record<string, unknown> | undefined

  if (name === "bash" && input?.command) {
    // Truncate long commands
    const cmd = String(input.command)
    const firstLine = cmd.split("\n")[0]
    return firstLine.length > 60 ? `${firstLine.slice(0, 60)}...` : firstLine
  }

  if ((name === "read" || name === "edit" || name === "write") && input?.file_path) {
    const filePath = String(input.file_path)
    return filePath.split("/").pop() || filePath
  }

  if (name === "grep" && input?.pattern) {
    return `searching: ${input.pattern}`
  }

  if (name === "glob" && input?.pattern) {
    return `finding: ${input.pattern}`
  }

  if (name === "task" && input?.description) {
    return String(input.description)
  }

  return tool.toolName
}

function formatElapsedTime(seconds: number): string {
  if (seconds < 1) return ""
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return `${minutes}m ${remainingSeconds}s`
}

function PendingToolItem({ tool }: { tool: PendingTool }) {
  const Icon = getToolIcon(tool.toolName)
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
    <div className={cn("flex items-center gap-2 mb-2 text-xs", mutedText)}>
      <div className="flex items-center gap-1.5">
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <Icon size={ICON_SIZE} className={mutedIcon} />
        <span className={cn(monoText, "truncate max-w-[300px]")}>{label}</span>
        {displayElapsed && (
          <span className="text-black/30 dark:text-white/30 font-mono text-[10px]">{displayElapsed}</span>
        )}
      </div>
    </div>
  )
}

/**
 * ThinkingIndicator - Shows when stream is active but no tools are running yet
 * Provides immediate feedback when user sends a message
 */
function ThinkingIndicator() {
  return (
    <div className={cn("flex items-center gap-2 mb-2 text-xs", mutedText)} data-testid="thinking-indicator">
      <div className="flex items-center gap-1.5">
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <Sparkles size={ICON_SIZE} className={mutedIcon} />
        <span>Thinking...</span>
      </div>
    </div>
  )
}

export function PendingToolsIndicator({ tabId }: PendingToolsIndicatorProps) {
  const pendingTools = usePendingTools(tabId)
  const isStreamActive = useIsStreamActive(tabId)

  // Show thinking indicator when stream is active but no tools are running
  if (isStreamActive && pendingTools.length === 0) {
    return <ThinkingIndicator />
  }

  // Show pending tools when they exist
  if (pendingTools.length === 0) {
    return null
  }

  return (
    <div>
      {pendingTools.map(tool => (
        <PendingToolItem key={tool.toolUseId} tool={tool} />
      ))}
    </div>
  )
}
