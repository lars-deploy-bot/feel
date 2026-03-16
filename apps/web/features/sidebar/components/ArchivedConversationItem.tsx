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
        className="w-full flex items-center gap-2 px-3 py-2.5 mx-2 rounded-lg cursor-pointer hover:bg-[#4a7c59]/[0.05] dark:hover:bg-[#7cb88a]/[0.05] transition-all duration-150 ease-out"
        style={{ width: "calc(100% - 16px)" }}
      >
        <span className="flex-1 min-w-0 text-[13px] text-[#8a8578] dark:text-[#7a756b] truncate text-left">
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
          className="opacity-0 group-hover:opacity-100 size-5 rounded-lg flex items-center justify-center text-[#b5afa3] dark:text-[#5c574d] hover:text-[#5c574d] dark:hover:text-[#b5afa3] transition-all duration-150 ease-out active:scale-90 shrink-0"
          aria-label="Restore"
        >
          <ArchiveRestore size={11} strokeWidth={1.75} />
        </span>
      </button>
    </div>
  )
}
