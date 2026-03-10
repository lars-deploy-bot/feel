"use client"

import { ArchiveRestore } from "lucide-react"
import type { DbConversation } from "@/lib/db/messageDb"

export function ArchivedConversationItem({
  conversation,
  onOpen,
  onRestore,
}: {
  conversation: DbConversation
  onOpen: () => void
  onRestore: () => void
}) {
  return (
    <div className="group">
      <button
        type="button"
        onClick={onOpen}
        className="w-full flex items-center gap-2 px-3 py-1.5 mx-2 rounded-lg cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors duration-100"
        style={{ width: "calc(100% - 16px)" }}
      >
        <span className="flex-1 min-w-0 text-[13px] text-black/35 dark:text-white/35 truncate text-left">
          {conversation.title}
        </span>
        {/* biome-ignore lint/a11y/useSemanticElements: Nested buttons are invalid HTML, using span with role instead */}
        <span
          role="button"
          tabIndex={0}
          onClick={e => {
            e.stopPropagation()
            onRestore()
          }}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              e.stopPropagation()
              onRestore()
            }
          }}
          className="opacity-0 group-hover:opacity-100 size-5 rounded flex items-center justify-center text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60 transition-all duration-100 active:scale-90 shrink-0"
          aria-label="Restore"
        >
          <ArchiveRestore size={11} strokeWidth={1.75} />
        </span>
      </button>
    </div>
  )
}
