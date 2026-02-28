"use client"

import { ArchiveRestore } from "lucide-react"
import type { DbConversation } from "@/lib/db/messageDb"
import { styles } from "../sidebar-styles"
import { formatTimestamp } from "../utils"

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
    <div className="border-b border-black/[0.06] dark:border-white/[0.06] last:border-b-0 group">
      <button
        type="button"
        onClick={onOpen}
        className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-left cursor-pointer ${styles.transition} ${styles.hoverFill}`}
      >
        <div className="flex-1 min-w-0 opacity-50 group-hover:opacity-70 transition-opacity">
          <div className={`text-sm ${styles.textPrimary} truncate`}>{conversation.title}</div>
          <div className={`text-xs ${styles.textMuted} mt-0.5`}>
            Archived {formatTimestamp(conversation.archivedAt ?? conversation.updatedAt)}
          </div>
        </div>
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
          className={`opacity-40 md:opacity-0 md:group-hover:opacity-100 size-6 rounded flex items-center justify-center text-black/40 dark:text-white/40 hover:text-black/60 dark:hover:text-white/60 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] ${styles.transitionAll} active:scale-90 shrink-0`}
          aria-label="Restore without opening"
        >
          <ArchiveRestore size={13} strokeWidth={1.75} />
        </span>
      </button>
    </div>
  )
}
