"use client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react"
import type { KanbanAdapter, KanbanCard, KanbanCardCreate, KanbanCardUpdate, KanbanSortField } from "./types"

// ── Sorting ─────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 }

function sortCards(cards: KanbanCard[], field: KanbanSortField): KanbanCard[] {
  if (field === "manual") return cards.slice().sort((a, b) => a.order - b.order)

  return cards.slice().sort((a, b) => {
    switch (field) {
      case "priority":
        return (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4)
      case "created":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case "due": {
        // Cards with no due date go to the end
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      }
      case "title":
        return a.title.localeCompare(b.title)
      default:
        return a.order - b.order
    }
  })
}

// ── Focus / Selection State ─────────────────────────────────────────────────

interface FocusState {
  columnId: string | null
  cardId: string | null
}

interface KanbanContextValue {
  adapter: KanbanAdapter
  cards: KanbanCard[]
  cardsByColumn: Map<string, KanbanCard[]>
  isLoading: boolean
  // Sort
  sortField: KanbanSortField
  setSortField: (field: KanbanSortField) => void
  // Mutations
  moveCard: (cardId: string, toColumnId: string, order: number) => void
  createCard: (input: KanbanCardCreate) => void
  updateCard: (cardId: string, updates: KanbanCardUpdate) => void
  deleteCard: (cardId: string) => void
  // Focus
  focus: FocusState
  setFocus: (f: FocusState) => void
  // Selection
  selected: Set<string>
  toggleSelect: (cardId: string) => void
  clearSelection: () => void
  // Drag state
  draggedId: string | null
  setDraggedId: (id: string | null) => void
  // Panels
  editingCardId: string | null
  setEditingCardId: (id: string | null) => void
  creatingInColumn: string | null
  setCreatingInColumn: (colId: string | null) => void
  showShortcuts: boolean
  setShowShortcuts: (v: boolean) => void
}

const KanbanContext = createContext<KanbanContextValue | null>(null)

export function useKanban(): KanbanContextValue {
  const ctx = useContext(KanbanContext)
  if (!ctx) throw new Error("useKanban must be used within KanbanProvider")
  return ctx
}

export function KanbanProvider({ adapter, children }: { adapter: KanbanAdapter; children: ReactNode }) {
  const qc = useQueryClient()

  const { data: cards = [], isLoading } = useQuery({
    queryKey: [adapter.queryKey],
    queryFn: () => adapter.fetchCards(),
  })

  const [sortField, setSortField] = useState<KanbanSortField>("manual")

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, KanbanCard[]>()
    for (const col of adapter.columns) {
      map.set(col.id, [])
    }
    for (const card of cards) {
      const arr = map.get(card.columnId)
      if (arr) arr.push(card)
    }
    // Sort each column's cards
    for (const [colId, colCards] of map) {
      map.set(colId, sortCards(colCards, sortField))
    }
    return map
  }, [cards, adapter.columns, sortField])

  // ── Mutations ───────────────────────────────────────────────────────────

  const moveMut = useMutation({
    mutationFn: ({ cardId, toColumnId, order }: { cardId: string; toColumnId: string; order: number }) =>
      adapter.moveCard(cardId, toColumnId, order),
    onMutate({ cardId, toColumnId, order }) {
      qc.cancelQueries({ queryKey: [adapter.queryKey] })
      const prev = qc.getQueryData<KanbanCard[]>([adapter.queryKey])
      if (prev) {
        qc.setQueryData<KanbanCard[]>(
          [adapter.queryKey],
          prev.map(c => (c.id === cardId ? { ...c, columnId: toColumnId, order } : c)),
        )
      }
      return { prev }
    },
    onError(_err, _vars, ctx) {
      if (ctx?.prev) qc.setQueryData([adapter.queryKey], ctx.prev)
    },
    onSettled() {
      qc.invalidateQueries({ queryKey: [adapter.queryKey] })
    },
  })

  const createMut = useMutation({
    mutationFn: adapter.createCard.bind(adapter),
    onSettled() {
      qc.invalidateQueries({ queryKey: [adapter.queryKey] })
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ cardId, updates }: { cardId: string; updates: KanbanCardUpdate }) =>
      adapter.updateCard(cardId, updates),
    onSettled() {
      qc.invalidateQueries({ queryKey: [adapter.queryKey] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: adapter.deleteCard.bind(adapter),
    onSettled() {
      qc.invalidateQueries({ queryKey: [adapter.queryKey] })
    },
  })

  // ── Focus / Selection / Drag ──────────────────────────────────────────

  const [focus, setFocus] = useState<FocusState>({ columnId: null, cardId: null })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [creatingInColumn, setCreatingInColumn] = useState<string | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const toggleSelect = useCallback((cardId: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  const value: KanbanContextValue = useMemo(
    () => ({
      adapter,
      cards,
      cardsByColumn,
      isLoading,
      sortField,
      setSortField,
      moveCard: (cardId, toColumnId, order) => moveMut.mutate({ cardId, toColumnId, order }),
      createCard: input => createMut.mutate(input),
      updateCard: (cardId, updates) => updateMut.mutate({ cardId, updates }),
      deleteCard: cardId => deleteMut.mutate(cardId),
      focus,
      setFocus,
      selected,
      toggleSelect,
      clearSelection,
      draggedId,
      setDraggedId,
      editingCardId,
      setEditingCardId,
      creatingInColumn,
      setCreatingInColumn,
      showShortcuts,
      setShowShortcuts,
    }),
    [
      adapter,
      cards,
      cardsByColumn,
      isLoading,
      sortField,
      moveMut,
      createMut,
      updateMut,
      deleteMut,
      focus,
      selected,
      toggleSelect,
      clearSelection,
      draggedId,
      editingCardId,
      creatingInColumn,
      showShortcuts,
    ],
  )

  return <KanbanContext.Provider value={value}>{children}</KanbanContext.Provider>
}
