import { Code, Edit3, FileText, FolderOpen, Search, Terminal, Workflow } from "lucide-react"

/**
 * Maps tool names to their corresponding Lucide icon component
 *
 * @param toolName - Name of the tool (case-insensitive)
 * @returns Icon component from lucide-react
 */
export function getToolIcon(toolName: string) {
  const name = toolName.toLowerCase()

  if (name === "read") return FileText
  if (name === "write" || name === "edit") return Edit3
  if (name === "grep") return Search
  if (name === "glob") return FolderOpen
  if (name === "bash") return Terminal
  if (name === "task") return Workflow

  // Fallback patterns for variations
  if (name.includes("read")) return FileText
  if (name.includes("write") || name.includes("edit")) return Edit3
  if (name.includes("grep") || name.includes("search")) return Search
  if (name.includes("glob") || name.includes("find")) return FolderOpen
  if (name.includes("bash") || name.includes("task")) return Terminal

  return Code
}
