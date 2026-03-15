"use client"
import { CalendarBlank, Link, TextAlignLeft } from "@phosphor-icons/react"
import { useKanban } from "./KanbanProvider"
import type { KanbanCard as CardType, KanbanPriority } from "./types"

const PRIORITY_DOTS: Record<KanbanPriority, string | null> = {
  urgent: "#EF4444",
  high: "#F97316",
  medium: "#EAB308",
  low: "#6B7280",
  none: null,
}

export function KanbanCardItem({ card }: { card: CardType }) {
  const { focus, setFocus, selected, toggleSelect, setEditingCardId, draggedId, setDraggedId } = useKanban()
  const isFocused = focus.cardId === card.id
  const isSelected = selected.has(card.id)
  const isDragged = draggedId === card.id

  const hasDescription = card.description.length > 0
  const attachmentCount = card.attachments.length
  const hasDueDate = card.dueDate !== null
  const isOverdue = hasDueDate && new Date(card.dueDate).getTime() < Date.now()
  const hasMetadata = hasDescription || attachmentCount > 0 || card.notes.length > 0 || hasDueDate

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/plain", card.id)
        setDraggedId(card.id)
        requestAnimationFrame(() => setFocus({ columnId: card.columnId, cardId: card.id }))
      }}
      onDragEnd={() => setDraggedId(null)}
      onClick={() => {
        setFocus({ columnId: card.columnId, cardId: card.id })
        setEditingCardId(card.id)
      }}
      onKeyDown={e => {
        if (e.key === "Enter") setEditingCardId(card.id)
        if (e.key === " ") {
          e.preventDefault()
          toggleSelect(card.id)
        }
      }}
      role="button"
      tabIndex={0}
      data-card-id={card.id}
      className={`
        group relative p-3.5 rounded-lg cursor-grab active:cursor-grabbing
        transition-all duration-100 select-none
        ${isDragged ? "opacity-30" : ""}
        ${
          isFocused
            ? "ring-2 ring-blue-500/40 bg-blue-50/50 dark:bg-blue-500/[0.08]"
            : "bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
        }
        ${isSelected ? "ring-2 ring-blue-500/60" : ""}
        shadow-sm border border-black/[0.06] dark:border-white/[0.06]
      `}
    >
      <div className="flex items-start gap-2">
        {/* Selection checkbox */}
        <div
          className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors
            ${
              isSelected
                ? "bg-blue-500 border-blue-500"
                : "border-black/15 dark:border-white/15 opacity-0 group-hover:opacity-100"
            }`}
          onClick={e => {
            e.stopPropagation()
            toggleSelect(card.id)
          }}
        >
          {isSelected && (
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path
                d="M1.5 4L3.2 5.5L6.5 2.5"
                stroke="white"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-[13px] leading-snug font-medium text-black/80 dark:text-white/75">{card.title}</span>

          {/* Description preview */}
          {hasDescription && (
            <p className="text-[12px] text-black/40 dark:text-white/30 mt-1 line-clamp-2 leading-relaxed">
              {card.description}
            </p>
          )}

          {/* Metadata row */}
          {hasMetadata && (
            <div className="flex items-center gap-2.5 mt-2">
              {hasDueDate && (
                <span
                  className={`flex items-center gap-0.5 text-[11px] ${isOverdue ? "text-red-500" : "text-black/25 dark:text-white/20"}`}
                >
                  <CalendarBlank size={11} className="shrink-0" />
                  {new Date(card.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              )}
              {card.notes.length > 0 && (
                <TextAlignLeft size={12} className="text-black/20 dark:text-white/15 shrink-0" />
              )}
              {attachmentCount > 0 && (
                <span className="flex items-center gap-0.5 text-[11px] text-black/25 dark:text-white/20">
                  <Link size={11} className="shrink-0" />
                  {attachmentCount}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Priority dot */}
        {PRIORITY_DOTS[card.priority] && (
          <span
            className="mt-1 w-2 h-2 rounded-full shrink-0"
            style={{ background: PRIORITY_DOTS[card.priority]! }}
            title={card.priority}
          />
        )}
      </div>
    </div>
  )
}
