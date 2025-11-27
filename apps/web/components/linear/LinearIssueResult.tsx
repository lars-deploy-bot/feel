/**
 * LinearIssueResult Component
 *
 * Renders a single Linear issue from MCP tool results.
 * Used for: mcp__linear__get_issue, mcp__linear__update_issue, mcp__linear__create_issue
 *
 * UX Principles:
 * - Show full title, never truncate
 * - Show full description, it's context
 * - Clear visual hierarchy: action → identifier → title → details
 * - Easy to scan, easy to click through
 */

"use client"

import { ExternalLink, CheckCircle2, Pencil, Plus, User, Folder, Clock } from "lucide-react"
import type { ToolResultRendererProps } from "@/lib/tools/tool-registry"

interface LinearMcpIssue {
  id: string
  identifier: string
  title: string
  description?: string
  priority: {
    value: number
    name: string
  }
  status: string
  url: string
  createdAt: string
  updatedAt: string
  project?: string
  team?: string
  assignee?: string
  labels?: Array<{ name: string; color?: string }>
}

const priorityConfig: Record<number, { color: string; bg: string; label: string }> = {
  0: { color: "text-zinc-400", bg: "bg-zinc-400", label: "No priority" },
  1: { color: "text-orange-500", bg: "bg-orange-500", label: "Urgent" },
  2: { color: "text-red-500", bg: "bg-red-500", label: "High" },
  3: { color: "text-yellow-500", bg: "bg-yellow-500", label: "Medium" },
  4: { color: "text-blue-500", bg: "bg-blue-500", label: "Low" },
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  Backlog: { bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-600 dark:text-zinc-400", dot: "bg-zinc-400" },
  Todo: { bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-600 dark:text-zinc-400", dot: "bg-zinc-400" },
  "In Progress": {
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
    text: "text-yellow-700 dark:text-yellow-400",
    dot: "bg-yellow-500",
  },
  "In Review": {
    bg: "bg-purple-50 dark:bg-purple-900/20",
    text: "text-purple-700 dark:text-purple-400",
    dot: "bg-purple-500",
  },
  Done: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  Canceled: { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
}

function getStatusStyle(status: string) {
  return statusConfig[status] || statusConfig.Backlog
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 10) return "just now"
  if (diffSecs < 60) return `${diffSecs}s ago`
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function getActionConfig(toolName: string) {
  if (toolName.includes("create"))
    return { icon: Plus, label: "Created issue", color: "text-emerald-500", bg: "bg-emerald-500/10" }
  if (toolName.includes("update"))
    return { icon: Pencil, label: "Updated issue", color: "text-blue-500", bg: "bg-blue-500/10" }
  return { icon: CheckCircle2, label: "Issue", color: "text-zinc-500", bg: "bg-zinc-500/10" }
}

export function LinearIssueResult({ data, toolName }: ToolResultRendererProps<LinearMcpIssue>) {
  const issue = data
  if (!issue?.identifier) return null

  const statusStyle = getStatusStyle(issue.status)
  const priority = priorityConfig[issue.priority?.value ?? 0]
  const action = getActionConfig(toolName)
  const ActionIcon = action.icon

  return (
    <div className="mt-2 rounded-xl border border-zinc-200 dark:border-zinc-700/50 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
      {/* Action header */}
      <div className={`flex items-center gap-2 px-4 py-2.5 ${action.bg} border-b border-zinc-100 dark:border-zinc-800`}>
        <ActionIcon className={`w-4 h-4 ${action.color}`} />
        <span className={`text-sm font-medium ${action.color}`}>{action.label}</span>
      </div>

      {/* Main content - clickable */}
      <a
        href={issue.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        {/* Identifier row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {/* Linear logo */}
            <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 100 100" fill="currentColor">
              <path d="M50 0L93.3 25v50L50 100 6.7 75V25L50 0z" />
            </svg>
            <span className="text-sm font-mono font-semibold text-indigo-600 dark:text-indigo-400">
              {issue.identifier}
            </span>
          </div>
          <ExternalLink className="w-4 h-4 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Title - full, wrapped */}
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 leading-snug mb-3">{issue.title}</h3>

        {/* Description - full */}
        {issue.description && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4 whitespace-pre-wrap">
            {issue.description}
          </p>
        )}

        {/* Status & Priority badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {/* Status */}
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md ${statusStyle.bg} ${statusStyle.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
            {issue.status}
          </span>

          {/* Priority */}
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 ${priority.color}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${priority.bg}`} />
            {priority.label}
          </span>
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          {issue.project && (
            <span className="inline-flex items-center gap-1.5">
              <Folder className="w-3 h-3" />
              {issue.project}
            </span>
          )}
          {issue.assignee && (
            <span className="inline-flex items-center gap-1.5">
              <User className="w-3 h-3" />
              {issue.assignee}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(issue.updatedAt)}
          </span>
        </div>
      </a>
    </div>
  )
}

export function validateLinearIssue(data: unknown): boolean {
  if (!data || typeof data !== "object") return false
  const issue = data as Record<string, unknown>
  return "identifier" in issue && "title" in issue
}

export default LinearIssueResult
