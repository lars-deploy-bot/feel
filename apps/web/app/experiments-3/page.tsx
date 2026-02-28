"use client"

/**
 * Experiments 3: SDK Message Stream Simulator
 *
 * Full-width layout:
 * - Left sidebar: raw SDK stream + grouping debug
 * - Center: actual rendered chat (same width as real chat)
 *
 * Use the slider to scrub through the stream.
 * Switch between mock scenario and real conversation data.
 */

import { useEffect, useState } from "react"
import { CollapsibleToolGroup } from "@/features/chat/components/message-renderers/CollapsibleToolGroup"
import { MessageWrapper } from "@/features/chat/components/message-renderers/MessageWrapper"
import { groupToolMessages, type RenderItem } from "@/features/chat/lib/group-tool-messages"
import type { UIMessage } from "@/features/chat/lib/message-parser"
import { renderMessage, shouldRenderMessage } from "@/features/chat/lib/message-renderer"
import { cn } from "@/lib/utils"
import {
  EDGE_AI_AUTOMATION,
  EDGE_AI_CLARIFICATION,
  EDGE_ALL_ERRORS,
  EDGE_ASK_USER,
  EDGE_AT_THRESHOLD,
  EDGE_AUTH_ERROR,
  EDGE_BASH,
  EDGE_BELOW_THRESHOLD,
  EDGE_BILLING_ERROR,
  EDGE_BROKEN_GROUP,
  EDGE_CALENDAR,
  EDGE_CALENDAR_DELETE,
  EDGE_CALENDAR_MEETING,
  EDGE_EDIT,
  EDGE_EMAIL,
  EDGE_EMPTY_TEXT,
  EDGE_ERROR_GROUP,
  EDGE_ERROR_RESULT,
  EDGE_GLOB,
  EDGE_GREP,
  EDGE_GROUP_TRAILING_TASK,
  EDGE_LINEAR_COMMENT,
  EDGE_LINEAR_COMMENTS,
  EDGE_LINEAR_ISSUE,
  EDGE_LINEAR_ISSUES,
  EDGE_LINEAR_UPDATE,
  EDGE_LONG_GROUP,
  EDGE_MARKDOWN,
  EDGE_MAX_TURNS,
  EDGE_MCP_BROWSER,
  EDGE_MULTI_RESULT,
  EDGE_NETWORK_ERROR,
  EDGE_OVERLOADED,
  EDGE_PLAN_APPROVAL,
  EDGE_READ,
  EDGE_SESSION_CORRUPT,
  EDGE_STILL_RUNNING,
  EDGE_STOP_NOT_VERIFIED,
  EDGE_STOPPED,
  EDGE_STOPPING,
  EDGE_STRIPE_ACCOUNT,
  EDGE_STRIPE_BALANCE,
  EDGE_STRIPE_CUSTOMERS,
  EDGE_STRIPE_PAYMENTS,
  EDGE_STRIPE_SUBS,
  EDGE_TASK,
  EDGE_WEBFETCH,
  EDGE_WEBSEARCH,
  EDGE_WEBSITE_CONFIG,
  EDGE_WRITE_BASH,
} from "./edge-cases"
import { MOCK_MESSAGES } from "./mock-messages"
import planModeConversationRaw from "./plan-mode-conversation.json"
import realConversationRaw from "./real-conversation.json"

// Parse timestamps in real conversation data
const realConversation: UIMessage[] = (realConversationRaw as Array<Record<string, unknown>>).map(
  m =>
    ({
      ...m,
      timestamp: new Date(m.timestamp as string),
    }) as unknown as UIMessage,
)

const planModeConversation: UIMessage[] = (planModeConversationRaw as Array<Record<string, unknown>>).map(
  m =>
    ({
      ...m,
      timestamp: new Date(m.timestamp as string),
    }) as unknown as UIMessage,
)

// =============================================================================
// CONVERSATIONS
// =============================================================================

type Category = "full" | "grouping" | "tools" | "errors" | "custom"

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "full", label: "Full" },
  { id: "grouping", label: "Grouping" },
  { id: "tools", label: "Tools" },
  { id: "custom", label: "Custom UI" },
  { id: "errors", label: "Errors" },
]

interface Conversation {
  id: string
  label: string
  description: string
  category: Category
  /** Visual grouping within a category (e.g. "Linear", "Stripe") */
  group?: string
  messages: UIMessage[]
}

const CONVERSATIONS: Conversation[] = [
  // Full conversations
  {
    id: "real",
    label: "Real conversation",
    description: "74 messages — Task subagent reads 17 files, main agent does Glob/Read/Grep/Edit",
    category: "full",
    messages: realConversation,
  },
  {
    id: "mock",
    label: "Parallel subagents",
    description: "26 messages — two parallel Task subagents with interleaved messages",
    category: "full",
    messages: MOCK_MESSAGES,
  },
  {
    id: "plan-mode",
    label: "Plan mode",
    description: "64 messages — pipeline item + dev mode + EnterPlanMode → Task subagent → Write plan → ExitPlanMode",
    category: "full",
    messages: planModeConversation,
  },
  // Grouping edge cases
  {
    id: "below-threshold",
    label: "2 reads (no group)",
    description: "2 consecutive exploration results — below MIN_GROUP_SIZE, should NOT collapse",
    category: "grouping",
    messages: EDGE_BELOW_THRESHOLD,
  },
  {
    id: "at-threshold",
    label: "3 reads (groups)",
    description: "Exactly 3 consecutive exploration results — at MIN_GROUP_SIZE, SHOULD collapse",
    category: "grouping",
    messages: EDGE_AT_THRESHOLD,
  },
  {
    id: "broken-group",
    label: "Read→Edit→Read",
    description: "Edit breaks consecutive exploration run, prevents grouping",
    category: "grouping",
    messages: EDGE_BROKEN_GROUP,
  },
  {
    id: "long-group",
    label: "6 reads (big group)",
    description: "6 consecutive Read results → large collapsed group",
    category: "grouping",
    messages: EDGE_LONG_GROUP,
  },
  {
    id: "multi-result",
    label: "3 tools at once",
    description: "Single SDK message with 3 parallel tool_use + 3 tool_result blocks",
    category: "grouping",
    messages: EDGE_MULTI_RESULT,
  },
  {
    id: "trailing-task",
    label: "Group + Task done",
    description: "Exploration group from subagent → trailing Task completed absorbed into group",
    category: "grouping",
    messages: EDGE_GROUP_TRAILING_TASK,
  },
  {
    id: "empty-text",
    label: "Empty text blocks",
    description: "Assistant sends empty/whitespace text blocks — should be filtered",
    category: "grouping",
    messages: EDGE_EMPTY_TEXT,
  },
  {
    id: "error-group",
    label: "Errors in group",
    description: "4 Reads where 2 fail — errors inside a collapsed exploration group",
    category: "grouping",
    messages: EDGE_ERROR_GROUP,
  },
  {
    id: "all-errors",
    label: "All errors in group",
    description: "3 consecutive Reads that all fail — entire group is errors",
    category: "grouping",
    messages: EDGE_ALL_ERRORS,
  },
  // Tool rendering
  {
    id: "error",
    label: "Error result",
    description: "Tool result with is_error: true (path traversal blocked)",
    category: "tools",
    messages: EDGE_ERROR_RESULT,
  },
  {
    id: "read",
    label: "Read",
    description: "Read a file with line numbers and content",
    category: "tools",
    messages: EDGE_READ,
  },
  {
    id: "edit",
    label: "Edit",
    description: "File edit with old_string → new_string replacement",
    category: "tools",
    messages: EDGE_EDIT,
  },
  {
    id: "write-bash",
    label: "Write + Bash",
    description: "Mutation tools: Write creates file, Bash runs tests",
    category: "tools",
    messages: EDGE_WRITE_BASH,
  },
  {
    id: "bash",
    label: "Bash",
    description: "Standalone shell command execution with test output",
    category: "tools",
    messages: EDGE_BASH,
  },
  {
    id: "glob",
    label: "Glob",
    description: "File pattern matching to discover project files",
    category: "tools",
    messages: EDGE_GLOB,
  },
  {
    id: "grep",
    label: "Grep",
    description: "Content search across source files",
    category: "tools",
    messages: EDGE_GREP,
  },
  {
    id: "webfetch",
    label: "WebFetch",
    description: "Fetch and summarize a web page",
    category: "tools",
    messages: EDGE_WEBFETCH,
  },
  {
    id: "websearch",
    label: "WebSearch",
    description: "Search the web for current information",
    category: "tools",
    messages: EDGE_WEBSEARCH,
  },
  {
    id: "ask-user",
    label: "AskUserQuestion",
    description: "Interactive clarification with multiple choice options",
    category: "tools",
    messages: EDGE_ASK_USER,
  },
  {
    id: "task",
    label: "Task subagent",
    description: "Spawns a subagent to explore then returns result",
    category: "tools",
    messages: EDGE_TASK,
  },
  {
    id: "mcp-browser",
    label: "MCP browser",
    description: "MCP tool: alive-workspace browser screenshot",
    category: "tools",
    messages: EDGE_MCP_BROWSER,
  },
  {
    id: "markdown",
    label: "Rich markdown",
    description: "Headers, code blocks, lists, blockquotes in assistant text",
    category: "tools",
    messages: EDGE_MARKDOWN,
  },
  // Custom MCP UI — Linear
  {
    id: "linear-issue",
    label: "Create issue",
    description: "Single issue card with Created badge, priority, status, assignee",
    category: "custom",
    group: "Linear",
    messages: EDGE_LINEAR_ISSUE,
  },
  {
    id: "linear-update",
    label: "Update issue",
    description: "Issue card with Updated badge after status change",
    category: "custom",
    group: "Linear",
    messages: EDGE_LINEAR_UPDATE,
  },
  {
    id: "linear-issues",
    label: "List issues",
    description: "Table of 6 issues with filtering, sorting, hidden completed",
    category: "custom",
    group: "Linear",
    messages: EDGE_LINEAR_ISSUES,
  },
  {
    id: "linear-comment",
    label: "Comment",
    description: "Comment added to an issue (empty response with toolInput fallback)",
    category: "custom",
    group: "Linear",
    messages: EDGE_LINEAR_COMMENT,
  },
  {
    id: "linear-comments",
    label: "List comments",
    description: "3 comments thread on an issue",
    category: "custom",
    group: "Linear",
    messages: EDGE_LINEAR_COMMENTS,
  },
  // Custom MCP UI — Stripe
  {
    id: "stripe-subs",
    label: "Subscriptions",
    description: "Subscriptions table with plan, amount, billing date, status",
    category: "custom",
    group: "Stripe",
    messages: EDGE_STRIPE_SUBS,
  },
  {
    id: "stripe-customers",
    label: "Customers",
    description: "Customer table with name, email, balance",
    category: "custom",
    group: "Stripe",
    messages: EDGE_STRIPE_CUSTOMERS,
  },
  {
    id: "stripe-balance",
    label: "Balance",
    description: "Account balance with available, pending, instant amounts",
    category: "custom",
    group: "Stripe",
    messages: EDGE_STRIPE_BALANCE,
  },
  {
    id: "stripe-account",
    label: "Account",
    description: "Account info card with display name and ID",
    category: "custom",
    group: "Stripe",
    messages: EDGE_STRIPE_ACCOUNT,
  },
  {
    id: "stripe-payments",
    label: "Payments",
    description: "Payment intents table with status, amount, customer",
    category: "custom",
    group: "Stripe",
    messages: EDGE_STRIPE_PAYMENTS,
  },
  // Custom MCP UI — Email
  {
    id: "email-draft",
    label: "Compose",
    description: "Gmail email draft card with send/save actions",
    category: "custom",
    group: "Gmail",
    messages: EDGE_EMAIL,
  },
  // Custom MCP UI — Calendar
  {
    id: "calendar-event",
    label: "Create event",
    description: "Event draft card with attendees and create action",
    category: "custom",
    group: "Calendar",
    messages: EDGE_CALENDAR,
  },
  {
    id: "calendar-delete",
    label: "Delete event",
    description: "Delete confirmation card for an existing event",
    category: "custom",
    group: "Calendar",
    messages: EDGE_CALENDAR_DELETE,
  },
  {
    id: "calendar-meeting",
    label: "Propose meeting",
    description: "Meeting proposal with suggested time slot",
    category: "custom",
    group: "Calendar",
    messages: EDGE_CALENDAR_MEETING,
  },
  // Custom MCP UI — AI tools
  {
    id: "ai-clarification",
    label: "Clarification",
    description: "Interactive questionnaire with 2 questions and 3 options each",
    category: "custom",
    group: "AI",
    messages: EDGE_AI_CLARIFICATION,
  },
  {
    id: "website-config",
    label: "Website config",
    description: "Site creation form with template picker and subdomain input",
    category: "custom",
    group: "AI",
    messages: EDGE_WEBSITE_CONFIG,
  },
  {
    id: "ai-automation",
    label: "Automation config",
    description: "Automation job setup form with site picker and schedule",
    category: "custom",
    group: "AI",
    messages: EDGE_AI_AUTOMATION,
  },
  // Custom MCP UI — Plan mode
  {
    id: "plan-approval",
    label: "Approval",
    description: "Exit plan mode — user must approve before Claude can execute",
    category: "custom",
    group: "Plan",
    messages: EDGE_PLAN_APPROVAL,
  },
  // System errors
  {
    id: "network-error",
    label: "Network error",
    description: "Connection lost mid-conversation — amber styling, retry button",
    category: "errors",
    messages: EDGE_NETWORK_ERROR,
  },
  {
    id: "auth-error",
    label: "Auth expired",
    description: "Anthropic OAuth token expired — red error with request ID",
    category: "errors",
    messages: EDGE_AUTH_ERROR,
  },
  {
    id: "billing-error",
    label: "No credits",
    description: "Insufficient credits — billing error with balance shown",
    category: "errors",
    messages: EDGE_BILLING_ERROR,
  },
  {
    id: "max-turns",
    label: "Max turns",
    description: "SDK result with error_max_turns subtype — conversation too long",
    category: "errors",
    messages: EDGE_MAX_TURNS,
  },
  {
    id: "session-corrupt",
    label: "Session corrupt",
    description: "Tool call interrupted — blue styling, continue in new tab",
    category: "errors",
    messages: EDGE_SESSION_CORRUPT,
  },
  {
    id: "overloaded",
    label: "Overloaded",
    description: "HTTP 529 — API temporarily overloaded",
    category: "errors",
    messages: EDGE_OVERLOADED,
  },
  {
    id: "stopping",
    label: "Stopping",
    description: "Stop in progress — blue dot, waiting for backend confirmation",
    category: "errors",
    messages: EDGE_STOPPING,
  },
  {
    id: "stopped",
    label: "Stopped",
    description: "User clicked stop — gray dot, minimal inline hint",
    category: "errors",
    messages: EDGE_STOPPED,
  },
  {
    id: "still-running",
    label: "Still running",
    description: "Stop not confirmed — response continues, press stop again",
    category: "errors",
    messages: EDGE_STILL_RUNNING,
  },
  {
    id: "stop-not-verified",
    label: "Stop failed",
    description: "Could not confirm stop — check if response is still updating",
    category: "errors",
    messages: EDGE_STOP_NOT_VERIFIED,
  },
]

// =============================================================================
// AGENT COLORS
// =============================================================================

const AGENT_PALETTE = [
  { bg: "bg-blue-50 dark:bg-blue-950", border: "border-blue-200 dark:border-blue-800", dot: "bg-blue-400" },
  {
    bg: "bg-emerald-50 dark:bg-emerald-950",
    border: "border-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-400",
  },
  { bg: "bg-amber-50 dark:bg-amber-950", border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-400" },
  { bg: "bg-purple-50 dark:bg-purple-950", border: "border-purple-200 dark:border-purple-800", dot: "bg-purple-400" },
]

const MAIN_AGENT = {
  bg: "bg-zinc-50 dark:bg-zinc-900",
  border: "border-zinc-200 dark:border-zinc-700",
  dot: "bg-zinc-400",
}

function getAgentColor(parentToolUseId: string | null, agentMap: Map<string, number>) {
  if (!parentToolUseId) return MAIN_AGENT
  if (!agentMap.has(parentToolUseId)) {
    agentMap.set(parentToolUseId, agentMap.size)
  }
  return AGENT_PALETTE[agentMap.get(parentToolUseId)! % AGENT_PALETTE.length]
}

function buildAgentMap(messages: UIMessage[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const m of messages) {
    if (m.type !== "sdk_message") continue
    const parent = (m.content as Record<string, unknown>)?.parent_tool_use_id as string | null
    if (parent && !map.has(parent)) {
      map.set(parent, map.size)
    }
  }
  return map
}

function buildAgentLabels(
  agentMap: Map<string, number>,
): Array<{ id: string; label: string; color: typeof MAIN_AGENT }> {
  const labels = [{ id: "main", label: "main agent", color: MAIN_AGENT }]
  for (const [toolId, idx] of agentMap) {
    labels.push({
      id: toolId,
      label: `subagent (${toolId.slice(0, 12)}...)`,
      color: AGENT_PALETTE[idx % AGENT_PALETTE.length],
    })
  }
  return labels
}

// =============================================================================
// MESSAGE SUMMARY (shared by card + copy)
// =============================================================================

function getMessageSummary(message: UIMessage) {
  const sdkContent = message.type === "sdk_message" ? (message.content as Record<string, unknown>) : null
  const parentId = sdkContent?.parent_tool_use_id as string | null
  const msgType = sdkContent?.type as string | undefined
  const isAssistant = msgType === "assistant"

  let summary = ""
  const toolNames: string[] = []

  if (message.type === "user" && !sdkContent) {
    summary = String(message.content).slice(0, 60)
  } else if (msgType === "assistant") {
    const content = (sdkContent?.message as Record<string, unknown>)?.content as
      | Array<Record<string, unknown>>
      | undefined
    if (content) {
      for (const block of content) {
        if (block.type === "text") summary += `${String(block.text).slice(0, 40)} `
        if (block.type === "tool_use") toolNames.push(String(block.name))
      }
    }
  } else if (msgType === "user") {
    const content = (sdkContent?.message as Record<string, unknown>)?.content as
      | Array<Record<string, unknown>>
      | undefined
    if (content) {
      for (const block of content) {
        if (block.type === "tool_result") toolNames.push(String(block.tool_name ?? "?"))
      }
    }
  }

  const label = message.type === "user" && !sdkContent ? "user" : isAssistant ? "ast" : "res"
  const detail = toolNames.length > 0 ? toolNames.join(", ") : summary.trim()

  return { sdkContent, parentId, msgType, isAssistant, toolNames, summary, label, detail }
}

function buildDebugText(conversation: Conversation, visible: UIMessage[]) {
  const lines = [
    `scenario: ${conversation.label} (${conversation.description})`,
    `visible: ${visible.length}/${conversation.messages.length}`,
    "---",
  ]
  for (let i = 0; i < visible.length; i++) {
    const { label, detail } = getMessageSummary(visible[i])
    lines.push(`${i} ${label} ${detail}`)
  }
  return lines.join("\n")
}

// =============================================================================
// COPY DEBUG BUTTON
// =============================================================================

function CopyDebugButton({ conversation, visible }: { conversation: Conversation; visible: UIMessage[] }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(buildDebugText(conversation, visible))
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="text-[9px] font-mono text-black/20 dark:text-white/20 hover:text-black/50 dark:hover:text-white/50 transition-colors"
    >
      {copied ? "copied" : "copy"}
    </button>
  )
}

// =============================================================================
// RAW MESSAGE CARD
// =============================================================================

function RawMessageCard({
  message,
  index,
  agentMap,
}: {
  message: UIMessage
  index: number
  agentMap: Map<string, number>
}) {
  const { sdkContent, parentId, isAssistant, toolNames, summary } = getMessageSummary(message)
  const agent = getAgentColor(parentId ?? null, agentMap)

  return (
    <div className={cn("rounded border px-2 py-1 text-[10px] leading-tight", agent.border, agent.bg)}>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-black/20 dark:text-white/20 w-4 text-right shrink-0">{index}</span>
        <span className={cn("size-1.5 rounded-full shrink-0", agent.dot)} />
        <span className="font-medium text-black/50 dark:text-white/50">
          {message.type === "user" && !sdkContent ? "user" : isAssistant ? "ast" : "res"}
        </span>
        {toolNames.length > 0 && (
          <span className="flex gap-0.5 flex-wrap">
            {toolNames.map((name, i) => (
              <span
                key={i}
                className={cn(
                  "px-1 rounded text-[9px] font-mono",
                  name === "Task"
                    ? "bg-purple-200/60 dark:bg-purple-800/40 text-purple-700 dark:text-purple-300"
                    : name === "Edit" || name === "Write"
                      ? "bg-orange-200/60 dark:bg-orange-800/40 text-orange-700 dark:text-orange-300"
                      : "bg-black/[0.06] dark:bg-white/[0.08] text-black/40 dark:text-white/40",
                )}
              >
                {name}
              </span>
            ))}
          </span>
        )}
        {summary.trim() && !toolNames.length && (
          <span className="text-black/30 dark:text-white/30 truncate">{summary.trim()}</span>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// RENDERED CHAT VIEW (actual components)
// =============================================================================

function RenderedView({ messages }: { messages: UIMessage[] }) {
  const filtered = messages.filter(message => shouldRenderMessage(message, false))
  const renderItems: RenderItem[] = groupToolMessages(filtered)

  return (
    <div>
      {renderItems.map(item => {
        if (item.type === "group") {
          return (
            <MessageWrapper
              key={`group-${item.messages[0].id}`}
              messageId={item.messages[0].id}
              tabId="experiment"
              canDelete={false}
            >
              <CollapsibleToolGroup
                messages={item.messages}
                trailingTaskResult={item.trailingTaskResult}
                subagentSummary={item.subagentSummary}
                tabId="experiment"
              />
            </MessageWrapper>
          )
        }

        const { message } = item
        const content = renderMessage(message)
        if (!content) return null

        return (
          <MessageWrapper key={message.id} messageId={message.id} tabId="experiment" canDelete={false}>
            {content}
          </MessageWrapper>
        )
      })}
    </div>
  )
}

// =============================================================================
// GROUPING DEBUG
// =============================================================================

function GroupingDebug({ messages }: { messages: UIMessage[] }) {
  const filtered = messages.filter(message => shouldRenderMessage(message, false))
  const renderItems = groupToolMessages(filtered)

  return (
    <div className="space-y-0.5 text-[10px] font-mono">
      {renderItems.map((item, i) => {
        if (item.type === "group") {
          const toolCounts: Record<string, number> = {}
          for (const msg of item.messages) {
            const content = (msg.content as Record<string, unknown>)?.message as Record<string, unknown> | undefined
            const items = content?.content as Array<Record<string, unknown>> | undefined
            if (items) {
              for (const block of items) {
                if (block.type === "tool_result") {
                  const name = String(block.tool_name ?? "?")
                  toolCounts[name] = (toolCounts[name] ?? 0) + 1
                }
              }
            }
          }
          const parts = Object.entries(toolCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([name, count]) => `${name}\u00d7${count}`)

          return (
            <div
              key={i}
              className="rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5"
            >
              <span className="text-blue-600 dark:text-blue-300 font-bold">GRP</span>
              <span className="text-blue-400/60 dark:text-blue-400/60 ml-1">{parts.join(", ")}</span>
              {item.subagentSummary && <span className="text-purple-500 ml-1">+Summary</span>}
              {item.trailingTaskResult && <span className="text-emerald-500 ml-1">+Task</span>}
            </div>
          )
        }

        const sdkContent = item.message.content as Record<string, unknown>
        const msgType = item.message.type === "user" ? "usr" : String(sdkContent?.type ?? item.message.type).slice(0, 3)

        return (
          <div
            key={i}
            className="rounded border border-black/[0.04] dark:border-white/[0.06] px-1.5 py-0.5 text-black/30 dark:text-white/30"
          >
            {msgType}
          </div>
        )
      })}
    </div>
  )
}

// =============================================================================
// PAGE
// =============================================================================

function DarkModeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"))
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="size-6 rounded-lg bg-black/[0.03] dark:bg-white/[0.06] flex items-center justify-center text-black/35 dark:text-white/35 hover:text-black/55 dark:hover:text-white/55 active:scale-95 transition-all duration-150"
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark ? (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ) : (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </button>
  )
}

export default function Experiments3Page() {
  const [activeCategory, setActiveCategory] = useState<Category>("full")
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [activeConvo, setActiveConvo] = useState(CONVERSATIONS[0].id)
  const conversation = CONVERSATIONS.find(c => c.id === activeConvo)!
  const [visibleCount, setVisibleCount] = useState(conversation.messages.length)
  const visible = conversation.messages.slice(0, visibleCount)
  const agentMap = buildAgentMap(visible)
  const agentLabels = buildAgentLabels(agentMap)

  const filteredConversations = CONVERSATIONS.filter(c => c.category === activeCategory)

  // Get unique groups for the active category
  const groups = [...new Set(filteredConversations.map(c => c.group).filter(Boolean))] as string[]

  // Filter by group if one is selected
  const visibleConversations = activeGroup
    ? filteredConversations.filter(c => c.group === activeGroup)
    : filteredConversations

  const switchCategory = (cat: Category) => {
    setActiveCategory(cat)
    const catConvos = CONVERSATIONS.filter(c => c.category === cat)
    const catGroups = [...new Set(catConvos.map(c => c.group).filter(Boolean))] as string[]
    const firstGroup = catGroups.length > 0 ? catGroups[0] : null
    setActiveGroup(firstGroup)
    const first = firstGroup ? catConvos.find(c => c.group === firstGroup) : catConvos[0]
    if (first) {
      setActiveConvo(first.id)
      setVisibleCount(first.messages.length)
    }
  }

  const switchGroup = (group: string) => {
    setActiveGroup(group)
    const first = filteredConversations.find(c => c.group === group)
    if (first) {
      setActiveConvo(first.id)
      setVisibleCount(first.messages.length)
    }
  }

  const switchConvo = (id: string) => {
    setActiveConvo(id)
    const c = CONVERSATIONS.find(c => c.id === id)!
    setVisibleCount(c.messages.length)
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="shrink-0 border-b border-black/[0.06] dark:border-white/[0.08] bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm z-10">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-medium text-black/60 dark:text-white/60">Stream Simulator</h1>
              <DarkModeToggle />
            </div>
            <div className="text-right shrink-0 ml-4">
              <span className="text-2xl font-mono font-bold text-black/70 dark:text-white/70 tabular-nums">
                {visibleCount}
              </span>
              <span className="text-sm font-mono text-black/20 dark:text-white/20">
                /{conversation.messages.length}
              </span>
            </div>
          </div>
          <div className="flex gap-3 mb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => switchCategory(cat.id)}
                className={cn(
                  "pb-1.5 text-[11px] font-medium transition-colors border-b-2 -mb-px",
                  activeCategory === cat.id
                    ? "border-black dark:border-white text-black/70 dark:text-white/70"
                    : "border-transparent text-black/30 dark:text-white/30 hover:text-black/50 dark:hover:text-white/50",
                )}
              >
                {cat.label}
                <span className="ml-1 text-[10px] text-black/20 dark:text-white/20">
                  {CONVERSATIONS.filter(c => c.category === cat.id).length}
                </span>
              </button>
            ))}
          </div>
          {/* Sub-tabs for groups (e.g. Linear, Stripe, Gmail...) */}
          {groups.length > 0 && (
            <div className="flex gap-1 mb-2">
              {groups.map(group => (
                <button
                  key={group}
                  type="button"
                  onClick={() => switchGroup(group)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors duration-100",
                    activeGroup === group
                      ? "bg-black/[0.06] dark:bg-white/[0.08] text-black/70 dark:text-white/70"
                      : "text-black/30 dark:text-white/30 hover:text-black/50 dark:hover:text-white/50",
                  )}
                >
                  {group}
                  <span className="ml-1 text-[10px] text-black/20 dark:text-white/20">
                    {filteredConversations.filter(c => c.group === group).length}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Conversation buttons */}
          <div className="flex flex-wrap gap-1 mb-2">
            {visibleConversations.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => switchConvo(c.id)}
                title={c.description}
                className={cn(
                  "px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors",
                  activeConvo === c.id
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "text-black/40 dark:text-white/40 hover:text-black/60 dark:hover:text-white/60 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <input
            type="range"
            min={0}
            max={conversation.messages.length}
            value={visibleCount}
            onChange={e => setVisibleCount(Number(e.target.value))}
            className="w-full h-1 bg-black/[0.06] dark:bg-white/[0.08] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-black dark:[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
          />

          <div className="flex items-center gap-3 mt-2">
            {agentLabels.map(a => (
              <div key={a.id} className="flex items-center gap-1">
                <span className={cn("size-1.5 rounded-full", a.color.dot)} />
                <span className="text-[10px] font-mono text-black/30 dark:text-white/30">{a.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main: sidebar + chat */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left sidebar: raw stream + grouping */}
        <div className="w-72 shrink-0 border-r border-black/[0.06] dark:border-white/[0.08] flex flex-col overflow-hidden">
          {/* Raw stream */}
          <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[10px] font-medium text-black/25 dark:text-white/25 tracking-wide uppercase">
                Raw SDK Stream
              </h2>
              <CopyDebugButton conversation={conversation} visible={visible} />
            </div>
            {visible.map((msg, i) => (
              <RawMessageCard key={msg.id} message={msg} index={i} agentMap={agentMap} />
            ))}
            {visibleCount === 0 && (
              <p className="text-[10px] text-black/15 dark:text-white/15 italic">Move slider...</p>
            )}
          </div>

          {/* Grouping debug */}
          <div className="shrink-0 border-t border-black/[0.06] dark:border-white/[0.08] p-3 max-h-48 overflow-y-auto">
            <h2 className="text-[10px] font-medium text-black/25 dark:text-white/25 tracking-wide mb-2 uppercase">
              Grouping
            </h2>
            {visibleCount > 0 ? (
              <GroupingDebug messages={visible} />
            ) : (
              <p className="text-[10px] text-black/15 dark:text-white/15 italic">No messages</p>
            )}
          </div>
        </div>

        {/* Center: rendered chat */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 mx-auto w-full md:max-w-[calc(42rem+3rem)]">
            {visibleCount > 0 ? (
              <RenderedView messages={visible} />
            ) : (
              <p className="text-xs text-black/15 dark:text-white/15 italic py-20 text-center">
                Move the slider to stream messages...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
