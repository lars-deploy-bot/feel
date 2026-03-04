import { getMcpToolFriendlyName, getToolActionLabel, getToolDetail, SDK_TOOL_LOWER } from "@webalive/shared"
import { useMemo } from "react"
import type { UIMessage } from "@/features/chat/lib/message-parser"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/**
 * Derives status text from the last assistant message when busy.
 * Shows what tool is currently being used (e.g., "Reading file.tsx", "Running npm").
 */
export function useStatusText(busy: boolean, messages: UIMessage[]): string | undefined {
  return useMemo(() => {
    if (!busy || messages.length === 0) return undefined

    // Find the last assistant message (not user/tool_result)
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg?.type !== "sdk_message" || !isRecord(msg.content)) continue
      if (msg.content.type !== "assistant" || !isRecord(msg.content.message)) continue

      const blocks = msg.content.message.content
      if (!Array.isArray(blocks) || blocks.length === 0) continue

      const lastBlock = blocks[blocks.length - 1]
      if (!isRecord(lastBlock)) continue

      if (lastBlock.type === "tool_use" && typeof lastBlock.name === "string") {
        const toolName = lastBlock.name

        // Check for MCP tools first - show friendly name
        const mcpFriendly = getMcpToolFriendlyName(toolName)
        if (mcpFriendly) {
          return `${mcpFriendly.provider}: ${mcpFriendly.action}`
        }

        // SDK tools: capitalize verb + detail
        const detail = getToolDetail(toolName, lastBlock.input)
        const verb = getToolActionLabel(toolName)

        if (toolName.toLowerCase() === SDK_TOOL_LOWER.GREP && detail) {
          return `Grep: ${detail.slice(0, 20)}${detail.length > 20 ? "..." : ""}`
        }

        if (detail) {
          return `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${detail}`
        }

        return `${toolName}...`
      }

      if (lastBlock.type === "thinking") {
        return "Thinking..."
      }
      // Found an assistant message but no actionable block, keep looking
    }
    return "Working..."
  }, [busy, messages])
}
