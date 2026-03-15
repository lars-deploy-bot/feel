"use client"
import { useEffect } from "react"
import { useKanban } from "./KanbanProvider"

/**
 * Keyboard navigation for the kanban board.
 * Only active when no modal is open and no input is focused.
 */
export function useKanbanKeyboard() {
  const {
    adapter,
    cardsByColumn,
    focus,
    setFocus,
    toggleSelect,
    moveCard,
    setEditingCardId,
    setCreatingInColumn,
    setShowShortcuts,
    deleteCard,
    editingCardId,
    creatingInColumn,
    showShortcuts,
  } = useKanban()

  const columns = adapter.columns
  const modalOpen = editingCardId !== null || creatingInColumn !== null || showShortcuts

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Skip when modal is open or user is typing in an input
      if (modalOpen) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      const { columnId, cardId } = focus
      const colIndex = columnId ? columns.findIndex(c => c.id === columnId) : -1
      const colCards = columnId ? (cardsByColumn.get(columnId) ?? []) : []
      const cardIndex = cardId ? colCards.findIndex(c => c.id === cardId) : -1

      switch (e.key) {
        case "j":
        case "ArrowDown": {
          e.preventDefault()
          if (!columnId) {
            // Focus first card of first non-empty column
            for (const col of columns) {
              const cc = cardsByColumn.get(col.id) ?? []
              if (cc.length > 0) { setFocus({ columnId: col.id, cardId: cc[0].id }); break }
            }
          } else {
            const next = colCards[cardIndex + 1]
            if (next) setFocus({ columnId, cardId: next.id })
          }
          break
        }
        case "k":
        case "ArrowUp": {
          e.preventDefault()
          if (columnId && cardIndex > 0) {
            setFocus({ columnId, cardId: colCards[cardIndex - 1].id })
          }
          break
        }
        case "ArrowLeft":
        case "h": {
          e.preventDefault()
          if (colIndex > 0) {
            const prevCol = columns[colIndex - 1]
            const prevCards = cardsByColumn.get(prevCol.id) ?? []
            const target = prevCards[Math.min(cardIndex, prevCards.length - 1)]
            setFocus({ columnId: prevCol.id, cardId: target?.id ?? null })
          }
          break
        }
        case "ArrowRight":
        case "l": {
          e.preventDefault()
          if (colIndex < columns.length - 1) {
            const nextCol = columns[colIndex + 1]
            const nextCards = cardsByColumn.get(nextCol.id) ?? []
            const target = nextCards[Math.min(cardIndex, nextCards.length - 1)]
            setFocus({ columnId: nextCol.id, cardId: target?.id ?? null })
          }
          break
        }
        case "c": {
          e.preventDefault()
          const col = columnId ?? columns[0]?.id ?? null
          if (col) setCreatingInColumn(col)
          break
        }
        case "e":
        case "Enter": {
          e.preventDefault()
          if (cardId) setEditingCardId(cardId)
          break
        }
        case "x": {
          e.preventDefault()
          if (cardId) toggleSelect(cardId)
          break
        }
        case "Backspace":
        case "Delete": {
          e.preventDefault()
          if (cardId) deleteCard(cardId)
          break
        }
        case "Escape": {
          e.preventDefault()
          setFocus({ columnId: null, cardId: null })
          break
        }
        case "?": {
          e.preventDefault()
          setShowShortcuts(true)
          break
        }
        default: {
          // Number keys 1-N → move focused card to column N
          const num = Number.parseInt(e.key, 10)
          if (num >= 1 && num <= columns.length && cardId && columnId) {
            e.preventDefault()
            const targetCol = columns[num - 1]
            if (targetCol.id !== columnId) {
              const targetCards = cardsByColumn.get(targetCol.id) ?? []
              moveCard(cardId, targetCol.id, targetCards.length)
              setFocus({ columnId: targetCol.id, cardId })
            }
          }
        }
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [
    modalOpen, focus, columns, cardsByColumn,
    setFocus, toggleSelect, moveCard, setEditingCardId,
    setCreatingInColumn, setShowShortcuts, deleteCard,
  ])
}
