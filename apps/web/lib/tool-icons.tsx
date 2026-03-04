import { SDK_TOOL_LOWER } from "@webalive/shared"
import { Code, CreditCard, Edit3, FileText, FolderOpen, Globe, Search, Terminal, Workflow } from "lucide-react"

/**
 * Maps tool names to their corresponding Lucide icon component
 *
 * @param toolName - Name of the tool (case-insensitive)
 * @returns Icon component from lucide-react
 */
export function getToolIcon(toolName: string) {
  const name = toolName.toLowerCase()

  if (name === SDK_TOOL_LOWER.READ) return FileText
  if (name === SDK_TOOL_LOWER.WRITE || name === SDK_TOOL_LOWER.EDIT) return Edit3
  if (name === SDK_TOOL_LOWER.GREP) return Search
  if (name === SDK_TOOL_LOWER.GLOB) return FolderOpen
  if (name === SDK_TOOL_LOWER.BASH) return Terminal
  if (name === SDK_TOOL_LOWER.TASK) return Workflow
  if (name === SDK_TOOL_LOWER.WEB_FETCH) return Globe

  // Stripe MCP tools
  if (name.includes("stripe")) return CreditCard

  // Fallback patterns for variations
  if (name.includes("read")) return FileText
  if (name.includes("write") || name.includes("edit")) return Edit3
  if (name.includes("grep") || name.includes("search")) return Search
  if (name.includes("glob") || name.includes("find")) return FolderOpen
  if (name.includes("bash") || name.includes("task")) return Terminal
  if (name.includes("webfetch") || name.includes("fetch")) return Globe

  return Code
}
