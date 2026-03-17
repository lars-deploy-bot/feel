"use client"

import { ChevronRight } from "lucide-react"
import { useState } from "react"
import type { DbConversation } from "@/lib/db/messageDb"
import { ArchivedConversationItem } from "./ArchivedConversationItem"

interface ArchivedSectionProps {
  archivedConversations: DbConversation[]
  onUnarchiveTabGroup: (id: string) => void
  onTabGroupClick: (id: string) => void
}

export function ArchivedSection({ archivedConversations, onUnarchiveTabGroup, onTabGroupClick }: ArchivedSectionProps) {
  const [expanded, setExpanded] = useState(false)

  if (archivedConversations.length === 0) return null

  return (
    <div className="shrink-0 border-t border-black/[0.04] dark:border-white/[0.04] py-1">
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="flex items-center gap-2 px-3 py-2 mx-2 rounded-lg w-[calc(100%-16px)] text-[13px] text-black/30 dark:text-white/30 hover:bg-black/[0.025] dark:hover:bg-white/[0.025] transition-colors duration-100"
      >
        <ChevronRight
          size={11}
          strokeWidth={2}
          className={`shrink-0 transition-transform duration-200 ease-out ${expanded ? "rotate-90" : ""}`}
        />
        <span className="truncate">Archived</span>
        <span className="text-[11px] text-black/20 dark:text-white/20 shrink-0 tabular-nums">
          {archivedConversations.length}
        </span>
      </button>
      {expanded && (
        <div className="max-h-40 overflow-y-auto pb-1">
          {archivedConversations.map(conversation => (
            <ArchivedConversationItem
              key={conversation.id}
              conversation={conversation}
              onOpen={() => {
                onUnarchiveTabGroup(conversation.id)
                onTabGroupClick(conversation.id)
              }}
              onRestore={() => onUnarchiveTabGroup(conversation.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
