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

import { useState } from "react"
import { CollapsibleToolGroup } from "@/features/chat/components/message-renderers/CollapsibleToolGroup"
import { MessageWrapper } from "@/features/chat/components/message-renderers/MessageWrapper"
import { groupToolMessages, type RenderItem } from "@/features/chat/lib/group-tool-messages"
import type { UIMessage } from "@/features/chat/lib/message-parser"
import { renderMessage, shouldRenderMessage } from "@/features/chat/lib/message-renderer"
import { cn } from "@/lib/utils"
import {
  EDGE_AT_THRESHOLD,
  EDGE_BELOW_THRESHOLD,
  EDGE_BROKEN_GROUP,
  EDGE_EMPTY_TEXT,
  EDGE_ERROR_RESULT,
  EDGE_GROUP_TRAILING_TASK,
  EDGE_LONG_GROUP,
  EDGE_MARKDOWN,
  EDGE_MULTI_RESULT,
  EDGE_WRITE_BASH,
} from "./edge-cases"
import { MOCK_MESSAGES } from "./mock-messages"
import realConversationRaw from "./real-conversation.json"

// Parse timestamps in real conversation data
const realConversation: UIMessage[] = (realConversationRaw as Array<Record<string, unknown>>).map(
  m =>
    ({
      ...m,
      timestamp: new Date(m.timestamp as string),
    }) as unknown as UIMessage,
)

// =============================================================================
// CONVERSATIONS
// =============================================================================

interface Conversation {
  id: string
  label: string
  description: string
  messages: UIMessage[]
}

const CONVERSATIONS: Conversation[] = [
  {
    id: "real",
    label: "Real conversation",
    description: "74 messages — Task subagent reads 17 files, main agent does Glob/Read/Grep/Edit",
    messages: realConversation,
  },
  {
    id: "mock",
    label: "Parallel subagents",
    description: "26 messages — two parallel Task subagents with interleaved messages",
    messages: MOCK_MESSAGES,
  },
  {
    id: "error",
    label: "Error result",
    description: "Tool result with is_error: true (path traversal blocked)",
    messages: EDGE_ERROR_RESULT,
  },
  {
    id: "below-threshold",
    label: "2 reads (no group)",
    description: "2 consecutive exploration results — below MIN_GROUP_SIZE, should NOT collapse",
    messages: EDGE_BELOW_THRESHOLD,
  },
  {
    id: "at-threshold",
    label: "3 reads (groups)",
    description: "Exactly 3 consecutive exploration results — at MIN_GROUP_SIZE, SHOULD collapse",
    messages: EDGE_AT_THRESHOLD,
  },
  {
    id: "broken-group",
    label: "Read→Edit→Read",
    description: "Edit breaks consecutive exploration run, prevents grouping",
    messages: EDGE_BROKEN_GROUP,
  },
  {
    id: "write-bash",
    label: "Write + Bash",
    description: "Mutation tools: Write creates file, Bash runs tests",
    messages: EDGE_WRITE_BASH,
  },
  {
    id: "multi-result",
    label: "3 tools at once",
    description: "Single SDK message with 3 parallel tool_use + 3 tool_result blocks",
    messages: EDGE_MULTI_RESULT,
  },
  {
    id: "empty-text",
    label: "Empty text blocks",
    description: "Assistant sends empty/whitespace text blocks — should be filtered",
    messages: EDGE_EMPTY_TEXT,
  },
  {
    id: "trailing-task",
    label: "Group + Task done",
    description: "Exploration group from subagent → trailing Task completed absorbed into group",
    messages: EDGE_GROUP_TRAILING_TASK,
  },
  {
    id: "markdown",
    label: "Rich markdown",
    description: "Headers, code blocks, lists, blockquotes in assistant text",
    messages: EDGE_MARKDOWN,
  },
  {
    id: "long-group",
    label: "6 reads (big group)",
    description: "6 consecutive Read results → large collapsed group",
    messages: EDGE_LONG_GROUP,
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
        if (block.type === "text") summary += String(block.text).slice(0, 40) + " "
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
    `---`,
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

export default function Experiments3Page() {
  const [activeConvo, setActiveConvo] = useState(CONVERSATIONS[0].id)
  const conversation = CONVERSATIONS.find(c => c.id === activeConvo)!
  const [visibleCount, setVisibleCount] = useState(conversation.messages.length)
  const visible = conversation.messages.slice(0, visibleCount)
  const agentMap = buildAgentMap(visible)
  const agentLabels = buildAgentLabels(agentMap)

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
            <h1 className="text-sm font-medium text-black/60 dark:text-white/60 shrink-0">Stream Simulator</h1>
            <div className="text-right shrink-0 ml-4">
              <span className="text-2xl font-mono font-bold text-black/70 dark:text-white/70 tabular-nums">
                {visibleCount}
              </span>
              <span className="text-sm font-mono text-black/20 dark:text-white/20">
                /{conversation.messages.length}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 mb-2">
            {CONVERSATIONS.map(c => (
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
