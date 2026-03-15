"use client"
import { ArrowsDownUp } from "@phosphor-icons/react"
import { X } from "lucide-react"
import { useEffect, useRef, useState, type FormEvent } from "react"
import type { KanbanAttachment, KanbanPriority, KanbanSortField } from "./types"
import { KanbanColumn } from "./KanbanColumn"
import { useKanban } from "./KanbanProvider"
import { useKanbanKeyboard } from "./useKanbanKeyboard"

// ── Main Board ──────────────────────────────────────────────────────────────

export function Kanban() {
  const { cards, isLoading, editingCardId, creatingInColumn } = useKanban()

  useKanbanKeyboard()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-[13px] text-zinc-300 dark:text-zinc-700">Loading</span>
      </div>
    )
  }

  const showDetailPanel = editingCardId !== null || creatingInColumn !== null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 shrink-0">
        <h2 className="text-[15px] font-semibold text-black/80 dark:text-white/70">Todos</h2>
        <span className="text-[12px] text-black/30 dark:text-white/20 tabular-nums">{cards.length}</span>
        <div className="flex-1" />
        <SortPicker />
        <span className="text-[11px] text-black/20 dark:text-white/15">
          <kbd className="px-1 py-0.5 rounded bg-black/[0.04] dark:bg-white/[0.06] text-[10px] font-mono">?</kbd>
        </span>
      </div>

      {/* Board + Detail Panel */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Columns */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-2 px-3 pb-3 h-full min-w-min">
            <BoardColumns />
          </div>
        </div>

        {/* Detail panel — slides in from right */}
        {showDetailPanel && (
          <div className="w-[380px] shrink-0 border-l border-black/[0.06] dark:border-white/[0.04] overflow-y-auto bg-white dark:bg-[#0d0d0d]">
            {creatingInColumn ? <CreateCardPanel /> : <EditCardPanel />}
          </div>
        )}
      </div>

      <ShortcutsModal />
    </div>
  )
}

// ── Sort Picker ─────────────────────────────────────────────────────────────

const SORT_OPTIONS: Array<{ field: KanbanSortField; label: string }> = [
  { field: "manual", label: "Manual" },
  { field: "priority", label: "Priority" },
  { field: "due", label: "Due date" },
  { field: "created", label: "Created" },
  { field: "title", label: "Title" },
]

function SortPicker() {
  const { sortField, setSortField } = useKanban()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const active = SORT_OPTIONS.find(o => o.field === sortField)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[11px] text-black/30 dark:text-white/20 hover:text-black/50 dark:hover:text-white/40 transition-colors"
      >
        <ArrowsDownUp size={13} weight="bold" />
        <span>{active?.label ?? "Sort"}</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 w-32 bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.06] rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="p-1">
            {SORT_OPTIONS.map(({ field, label }) => (
              <button
                key={field}
                type="button"
                onClick={() => {
                  setSortField(field)
                  setOpen(false)
                }}
                className={`w-full text-left px-2.5 py-1.5 text-[12px] rounded-lg transition-colors
                  ${
                    sortField === field
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium"
                      : "text-black/50 dark:text-white/40 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BoardColumns() {
  const { adapter } = useKanban()
  return (
    <>
      {adapter.columns.map(col => (
        <KanbanColumn key={col.id} column={col} />
      ))}
    </>
  )
}

// ── Shared UI ───────────────────────────────────────────────────────────────

const INPUT_CLASS =
  "w-full px-3 py-2 text-sm rounded-lg border border-black/10 dark:border-white/10 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500/30"

const TEXTAREA_CLASS =
  "w-full px-3 py-2 text-sm rounded-lg border border-black/10 dark:border-white/10 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"

const LABEL_CLASS = "text-[11px] font-medium text-black/40 dark:text-white/30 uppercase tracking-wider"

function formatDueDate(date: string | null): string {
  if (!date) return ""
  const d = new Date(date)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days < 0) return "overdue"
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function isDueOverdue(date: string | null): boolean {
  if (!date) return false
  return new Date(date).getTime() < Date.now()
}

function PriorityPicker({ value, onChange }: { value: KanbanPriority; onChange: (p: KanbanPriority) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {(["none", "low", "medium", "high", "urgent"] as const).map(p => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`text-xs px-2.5 py-1 rounded-full capitalize transition-colors
            ${
              value === p
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium"
                : "text-black/40 dark:text-white/30 hover:text-black/60 dark:hover:text-white/50"
            }`}
        >
          {p}
        </button>
      ))}
    </div>
  )
}

function StatusPicker({ value, onChange }: { value: string; onChange: (colId: string) => void }) {
  const { adapter } = useKanban()
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {adapter.columns.map(col => (
        <button
          key={col.id}
          type="button"
          onClick={() => onChange(col.id)}
          className={`text-xs px-2.5 py-1 rounded-full transition-colors flex items-center gap-1.5
            ${
              value === col.id
                ? "font-medium"
                : "text-black/40 dark:text-white/30 hover:text-black/60 dark:hover:text-white/50"
            }`}
          style={value === col.id ? { background: `${col.color}15`, color: col.color } : undefined}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: col.color }} />
          {col.label}
        </button>
      ))}
    </div>
  )
}

function AttachmentEditor({
  attachments,
  onChange,
}: {
  attachments: KanbanAttachment[]
  onChange: (next: KanbanAttachment[]) => void
}) {
  const urlRef = useRef<HTMLInputElement>(null)
  const labelRef = useRef<HTMLInputElement>(null)

  function handleAdd() {
    const url = urlRef.current?.value.trim()
    const label = labelRef.current?.value.trim()
    if (!url) return
    onChange([...attachments, { url, label: label || url }])
    if (urlRef.current) urlRef.current.value = ""
    if (labelRef.current) labelRef.current.value = ""
    urlRef.current?.focus()
  }

  return (
    <div className="space-y-2">
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map((a, i) => (
            <div key={`${a.url}-${i}`} className="flex items-center gap-2 text-xs group/att">
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline truncate flex-1 min-w-0"
              >
                {a.label}
              </a>
              <button
                type="button"
                onClick={() => onChange(attachments.filter((_, j) => j !== i))}
                className="text-black/15 dark:text-white/10 hover:text-red-500 shrink-0 opacity-0 group-hover/att:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input
          ref={urlRef}
          placeholder="URL"
          className="flex-1 min-w-0 px-2 py-1.5 text-xs rounded-lg border border-black/10 dark:border-white/10 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleAdd()
            }
          }}
        />
        <input
          ref={labelRef}
          placeholder="Label"
          className="w-20 px-2 py-1.5 text-xs rounded-lg border border-black/10 dark:border-white/10 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleAdd()
            }
          }}
        />
        <button
          type="button"
          onClick={handleAdd}
          className="px-2.5 py-1.5 text-xs rounded-lg bg-black/[0.04] dark:bg-white/[0.06] text-black/50 dark:text-white/40 hover:text-black/70 dark:hover:text-white/60 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  )
}

// ── Create Card Panel ───────────────────────────────────────────────────────

function CreateCardPanel() {
  const { creatingInColumn, setCreatingInColumn, createCard, adapter } = useKanban()
  const titleRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const [priority, setPriority] = useState<KanbanPriority>("none")
  const [attachments, setAttachments] = useState<KanbanAttachment[]>([])
  const [columnId, setColumnId] = useState(creatingInColumn ?? "todo")
  const [dueDate, setDueDate] = useState("")

  const column = adapter.columns.find(c => c.id === columnId)

  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 50)
  }, [])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const title = titleRef.current?.value.trim()
    if (!title) return
    createCard({
      columnId,
      title,
      description: descRef.current?.value.trim() ?? "",
      priority,
      notes: notesRef.current?.value.trim() ?? "",
      attachments,
      dueDate: dueDate || null,
    })
    setPriority("none")
    setAttachments([])
    setDueDate("")
    setCreatingInColumn(null)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/[0.06] dark:border-white/[0.04]">
        <h3 className="text-[13px] font-semibold text-black/70 dark:text-white/60">New card</h3>
        <button
          type="button"
          onClick={() => setCreatingInColumn(null)}
          className="text-black/30 dark:text-white/20 hover:text-black/50 dark:hover:text-white/40"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <div>
          <label className={LABEL_CLASS}>Title</label>
          <input ref={titleRef} placeholder="What needs to be done?" className={`${INPUT_CLASS} mt-1.5`} />
        </div>

        <div>
          <label className={LABEL_CLASS}>Description</label>
          <textarea ref={descRef} placeholder="Add details..." rows={3} className={`${TEXTAREA_CLASS} mt-1.5`} />
        </div>

        <div>
          <label className={`${LABEL_CLASS} mb-1.5 block`}>Status</label>
          <StatusPicker value={columnId} onChange={setColumnId} />
        </div>

        <div>
          <label className={`${LABEL_CLASS} mb-1.5 block`}>Priority</label>
          <PriorityPicker value={priority} onChange={setPriority} />
        </div>

        <div>
          <label className={LABEL_CLASS}>Due date</label>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className={`${INPUT_CLASS} mt-1.5`}
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>Notes</label>
          <textarea ref={notesRef} placeholder="Internal notes..." rows={2} className={`${TEXTAREA_CLASS} mt-1.5`} />
        </div>

        <div>
          <label className={`${LABEL_CLASS} mb-1.5 block`}>Attachments</label>
          <AttachmentEditor attachments={attachments} onChange={setAttachments} />
        </div>
      </div>

      <div className="px-5 py-3.5 border-t border-black/[0.06] dark:border-white/[0.04]">
        <button
          type="submit"
          className="w-full py-2 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
        >
          Create in {column?.label ?? "column"}
        </button>
      </div>
    </form>
  )
}

// ── Edit Card Panel ─────────────────────────────────────────────────────────

function EditCardPanel() {
  const { editingCardId, setEditingCardId, cards, updateCard, deleteCard, moveCard, adapter, cardsByColumn } =
    useKanban()

  const card = editingCardId ? cards.find(c => c.id === editingCardId) : null
  const titleRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const [priority, setPriority] = useState<KanbanPriority>(card?.priority ?? "none")
  const [attachments, setAttachments] = useState<KanbanAttachment[]>([...(card?.attachments ?? [])])
  const [columnId, setColumnId] = useState(card?.columnId ?? "todo")
  const [dueDate, setDueDate] = useState(card?.dueDate ?? "")
  const prevCardId = useRef(editingCardId)

  // Sync state when switching to a different card
  if (editingCardId !== prevCardId.current) {
    prevCardId.current = editingCardId
    if (card) {
      setPriority(card.priority)
      setAttachments([...card.attachments])
      setColumnId(card.columnId)
      setDueDate(card.dueDate ?? "")
    }
  }

  if (!card) return null

  function handleSave() {
    const title = titleRef.current?.value.trim()
    if (!title || !card) return

    updateCard(card.id, {
      title,
      description: descRef.current?.value.trim() ?? "",
      priority,
      notes: notesRef.current?.value.trim() ?? "",
      attachments,
      dueDate: dueDate || null,
    })

    if (columnId !== card.columnId) {
      const targetCards = cardsByColumn.get(columnId) ?? []
      moveCard(card.id, columnId, targetCards.length)
    }

    setEditingCardId(null)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    handleSave()
  }

  function handleDelete() {
    if (!card) return
    deleteCard(card.id)
    setEditingCardId(null)
  }

  const column = adapter.columns.find(c => c.id === columnId)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/[0.06] dark:border-white/[0.04]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: column?.color ?? "#6B7280" }} />
          <h3 className="text-[13px] font-semibold text-black/70 dark:text-white/60">{column?.label ?? "Card"}</h3>
        </div>
        <button
          type="button"
          onClick={() => setEditingCardId(null)}
          className="text-black/30 dark:text-white/20 hover:text-black/50 dark:hover:text-white/40"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <div>
          <label className={LABEL_CLASS}>Title</label>
          <input ref={titleRef} defaultValue={card.title} className={`${INPUT_CLASS} mt-1.5`} />
        </div>

        <div>
          <label className={LABEL_CLASS}>Description</label>
          <textarea
            ref={descRef}
            defaultValue={card.description}
            placeholder="Add details..."
            rows={3}
            className={`${TEXTAREA_CLASS} mt-1.5`}
          />
        </div>

        <div>
          <label className={`${LABEL_CLASS} mb-1.5 block`}>Status</label>
          <StatusPicker value={columnId} onChange={setColumnId} />
        </div>

        <div>
          <label className={`${LABEL_CLASS} mb-1.5 block`}>Priority</label>
          <PriorityPicker value={priority} onChange={setPriority} />
        </div>

        <div>
          <label className={LABEL_CLASS}>Due date</label>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className={`${INPUT_CLASS} mt-1.5`}
          />
          {dueDate && (
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className={`text-[11px] ${isDueOverdue(dueDate) ? "text-red-500" : "text-black/30 dark:text-white/20"}`}
              >
                {formatDueDate(dueDate)}
              </span>
              <button
                type="button"
                onClick={() => setDueDate("")}
                className="text-[11px] text-black/20 dark:text-white/15 hover:text-black/40 dark:hover:text-white/30"
              >
                clear
              </button>
            </div>
          )}
        </div>

        <div>
          <label className={LABEL_CLASS}>Notes</label>
          <textarea
            ref={notesRef}
            defaultValue={card.notes}
            placeholder="Internal notes..."
            rows={2}
            className={`${TEXTAREA_CLASS} mt-1.5`}
          />
        </div>

        <div>
          <label className={`${LABEL_CLASS} mb-1.5 block`}>Attachments</label>
          <AttachmentEditor attachments={attachments} onChange={setAttachments} />
        </div>

        <div className="text-[11px] text-black/20 dark:text-white/15">
          Created {new Date(card.createdAt).toLocaleDateString()}
        </div>
      </div>

      <div className="px-5 py-3.5 border-t border-black/[0.06] dark:border-white/[0.04] flex gap-2">
        <button
          type="submit"
          className="flex-1 py-2 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
        >
          Save
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="px-4 py-2 text-sm font-medium rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          Delete
        </button>
      </div>
    </form>
  )
}

// ── Shortcuts Modal ─────────────────────────────────────────────────────────

const SHORTCUTS = [
  ["J / ↓", "Next card"],
  ["K / ↑", "Previous card"],
  ["← / →", "Adjacent column"],
  ["C", "Create card"],
  ["E / Enter", "Edit card"],
  ["X", "Toggle select"],
  ["1-N", "Move to column N"],
  ["Backspace", "Delete card"],
  ["Escape", "Clear focus"],
  ["?", "Show shortcuts"],
] as const

function ShortcutsModal() {
  const { showShortcuts, setShowShortcuts } = useKanban()
  if (!showShortcuts) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/40"
      onClick={e => {
        if (e.target === e.currentTarget) setShowShortcuts(false)
      }}
      onKeyDown={e => {
        if (e.key === "Escape") setShowShortcuts(false)
      }}
    >
      <div className="w-[320px] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-black/[0.06] dark:border-white/[0.06] p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-black/70 dark:text-white/60">Keyboard Shortcuts</h3>
            <button
              type="button"
              onClick={() => setShowShortcuts(false)}
              className="text-black/30 dark:text-white/20 hover:text-black/50 dark:hover:text-white/40"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-1.5">
            {SHORTCUTS.map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between py-1">
                <kbd className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-black/[0.04] dark:bg-white/[0.06] text-black/50 dark:text-white/40">
                  {key}
                </kbd>
                <span className="text-xs text-black/50 dark:text-white/40">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
