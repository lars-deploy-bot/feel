/**
 * LinearIssueResult Component
 *
 * Compact, minimized-by-default display for Linear issues.
 * Expands on click to show full details.
 */

"use client"

import { CheckCircle2, ChevronRight, Clock, Folder, Pencil, Plus, User } from "lucide-react"
import { useState } from "react"
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

const priorityColors: Record<number, string> = {
  0: "text-zinc-400",
  1: "text-orange-500",
  2: "text-red-500",
  3: "text-yellow-500",
  4: "text-blue-500",
}

const statusDots: Record<string, string> = {
  Backlog: "bg-zinc-400",
  Todo: "bg-zinc-400",
  "In Progress": "bg-yellow-500",
  "In Review": "bg-purple-500",
  Done: "bg-emerald-500",
  Canceled: "bg-red-500",
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function getActionIcon(toolName: string) {
  if (toolName.includes("create")) return { Icon: Plus, color: "text-emerald-500" }
  if (toolName.includes("update")) return { Icon: Pencil, color: "text-blue-500" }
  return { Icon: CheckCircle2, color: "text-zinc-500" }
}

export function LinearIssueResult({ data, toolName }: ToolResultRendererProps<LinearMcpIssue>) {
  const [expanded, setExpanded] = useState(false)
  const issue = data
  if (!issue?.identifier) return null

  const { Icon: ActionIcon, color: actionColor } = getActionIcon(toolName)
  const statusDot = statusDots[issue.status] || statusDots.Backlog
  const priorityColor = priorityColors[issue.priority?.value ?? 0]

  return (
    <div className="text-xs">
      {/* Compact chip */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/[0.09] transition-colors text-left"
      >
        <ChevronRight
          className={`w-3 h-3 text-black/40 dark:text-white/40 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
        />
        <ActionIcon className={`w-3.5 h-3.5 ${actionColor}`} />
        <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">{issue.identifier}</span>
        <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
        <span className="text-black/60 dark:text-white/60 truncate max-w-[200px]">{issue.title}</span>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 ml-1 pl-3 border-l-2 border-black/[0.06] dark:border-white/[0.08] space-y-2">
          {/* Title - full */}
          <div className="text-sm font-medium text-black/80 dark:text-white/80">{issue.title}</div>

          {/* Description */}
          {issue.description && (
            <p className="text-black/50 dark:text-white/50 leading-relaxed whitespace-pre-wrap">{issue.description}</p>
          )}

          {/* Status & Priority */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-black/60 dark:text-white/60">
              <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
              {issue.status}
            </span>
            <span className={`inline-flex items-center gap-1 ${priorityColor}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${priorityColor.replace("text-", "bg-")}`} />
              {issue.priority?.name || "No priority"}
            </span>
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-3 text-black/40 dark:text-white/40">
            {issue.project && (
              <span className="inline-flex items-center gap-1">
                <Folder className="w-3 h-3" />
                {issue.project}
              </span>
            )}
            {issue.assignee && (
              <span className="inline-flex items-center gap-1">
                <User className="w-3 h-3" />
                {issue.assignee}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(issue.updatedAt)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export function validateLinearIssue(data: unknown): boolean {
  if (!data || typeof data !== "object") return false
  const issue = data as Record<string, unknown>
  return "identifier" in issue && "title" in issue
}
