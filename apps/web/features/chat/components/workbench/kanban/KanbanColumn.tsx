"use client"
import { Plus } from "lucide-react"
import { useState } from "react"
import { KanbanCardItem } from "./KanbanCard"
import { useKanban } from "./KanbanProvider"
import type { KanbanColumnDef } from "./types"

export function KanbanColumn({ column }: { column: KanbanColumnDef }) {
  const { cardsByColumn, setCreatingInColumn, moveCard, setDraggedId, draggedId } = useKanban()
  const [collapsed, setCollapsed] = useState(column.collapsedByDefault ?? false)
  const [dragOver, setDragOver] = useState(false)
  const cards = cardsByColumn.get(column.id) ?? []

  if (collapsed) {
    return (
      <div
        className="shrink-0 flex flex-col items-center py-3 px-1 cursor-pointer rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
        style={{ width: 36 }}
        onClick={() => setCollapsed(false)}
        onDragOver={e => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          const cardId = e.dataTransfer.getData("text/plain")
          if (cardId) moveCard(cardId, column.id, cards.length)
          setDraggedId(null)
        }}
        title={`${column.label} (${cards.length})`}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 mb-2 ${dragOver ? "ring-2 ring-blue-500" : ""}`}
          style={{ background: column.color }}
        />
        <span className="text-[11px] font-medium text-black/40 dark:text-white/30 [writing-mode:vertical-rl] rotate-180">
          {column.label}
        </span>
        <span className="text-[10px] text-black/25 dark:text-white/20 mt-1">{cards.length}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-w-[260px] max-w-[320px] w-full shrink-0" data-column-id={column.id}>
      {/* Column header */}
      <div className="flex items-center gap-2 px-2 py-2 mb-1">
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="w-2.5 h-2.5 rounded-full shrink-0 hover:ring-2 hover:ring-offset-1 hover:ring-black/10 dark:hover:ring-white/10 transition-shadow"
          style={{ background: column.color }}
          title="Collapse column"
        />
        <span className="text-[13px] font-semibold text-black/70 dark:text-white/60 flex-1">{column.label}</span>
        <span className="text-[11px] text-black/30 dark:text-white/20 tabular-nums">{cards.length}</span>
        <button
          type="button"
          onClick={() => setCreatingInColumn(column.id)}
          className="p-0.5 rounded text-black/25 dark:text-white/20 hover:text-black/50 dark:hover:text-white/40 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
          title="Add card"
        >
          <Plus size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Drop zone + cards */}
      <div
        onDragOver={e => {
          e.preventDefault()
          e.dataTransfer.dropEffect = "move"
          setDragOver(true)
        }}
        onDragLeave={e => {
          // Only clear if leaving the column itself, not a child
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOver(false)
          }
        }}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          const cardId = e.dataTransfer.getData("text/plain")
          if (!cardId) return

          // Figure out drop position from mouse Y
          const cardElements = e.currentTarget.querySelectorAll("[data-card-id]")
          let insertIndex = cards.length
          for (let i = 0; i < cardElements.length; i++) {
            const rect = cardElements[i].getBoundingClientRect()
            if (e.clientY < rect.top + rect.height / 2) {
              insertIndex = i
              break
            }
          }

          moveCard(cardId, column.id, insertIndex)
          setDraggedId(null)
        }}
        className={`flex-1 flex flex-col gap-2 px-1 py-1 rounded-xl min-h-[60px] transition-colors duration-150
          ${dragOver && draggedId ? "bg-blue-500/[0.06] dark:bg-blue-400/[0.06]" : ""}`}
      >
        {cards.map(card => (
          <KanbanCardItem key={card.id} card={card} />
        ))}
      </div>
    </div>
  )
}
