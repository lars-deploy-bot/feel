import { useMemo, useState } from "react"
import { EmptyState } from "@/components/data/EmptyState"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"
import { cn } from "@/lib/cn"
import { FeedbackCard, FeedbackDetail } from "./components/FeedbackCard"
import type { FeedbackItem } from "./feedback.types"
import { useFeedback } from "./hooks/useFeedback"

type StatusFilter = "open" | "resolved" | "all"

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
]

function matchesFilter(item: FeedbackItem, filter: StatusFilter): boolean {
  switch (filter) {
    case "all":
      return true
    case "resolved":
      return !!item.closed_at
    case "open":
      return !item.closed_at
  }
}

export function FeedbackPage() {
  const { feedback, loading, error, refresh } = useFeedback()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<StatusFilter>("open")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let items = feedback
    if (filter !== "all") {
      items = items.filter(item => matchesFilter(item, filter))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(
        item =>
          item.content.toLowerCase().includes(q) ||
          (item.workspace ?? "").toLowerCase().includes(q) ||
          (item.email ?? "").toLowerCase().includes(q),
      )
    }
    return items
  }, [feedback, filter, search])

  const selectedItem = selectedId ? feedback.find(f => f.feedback_id === selectedId) : null

  const openCount = feedback.filter(item => !item.closed_at).length
  const resolvedCount = feedback.filter(item => !!item.closed_at).length

  if (loading && feedback.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load feedback"
        description={error}
        action={<Button onClick={refresh}>Retry</Button>}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Feedback"
        description={`${feedback.length} entr${feedback.length !== 1 ? "ies" : "y"}`}
        action={
          <Button onClick={refresh} size="sm" loading={loading}>
            Refresh
          </Button>
        }
      />

      <div className="flex gap-6 min-h-0" style={{ height: "calc(100vh - 220px)" }}>
        {/* Left: feedback list */}
        <div className="w-[340px] flex-shrink-0 flex flex-col min-h-0">
          {/* Search */}
          <div className="relative mb-3">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
            >
              <circle cx="5.5" cy="5.5" r="4.25" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 9L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <Input
              placeholder="Search feedback..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1 mb-2 flex-wrap">
            {FILTERS.map(f => {
              const count = f.id === "open" ? openCount : f.id === "resolved" ? resolvedCount : feedback.length
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "px-2 py-0.5 text-[11px] rounded-md transition-colors duration-100 cursor-pointer",
                    filter === f.id
                      ? "bg-surface-secondary text-text-primary font-medium"
                      : "text-text-tertiary hover:text-text-secondary",
                  )}
                >
                  {f.label}
                  <span className="ml-1 tabular-nums">{count}</span>
                </button>
              )
            })}
          </div>

          {search.trim() && filtered.length !== feedback.length && (
            <p className="text-[12px] text-text-tertiary mb-2 px-1">
              {filtered.length} of {feedback.length}
            </p>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[12px] text-text-tertiary">
                  {search || filter !== "all" ? "No matches" : "No feedback yet"}
                </p>
              </div>
            ) : (
              filtered.map(item => (
                <FeedbackCard
                  key={item.feedback_id}
                  item={item}
                  selected={item.feedback_id === selectedId}
                  onSelect={setSelectedId}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="flex-1 min-w-0 border-l border-border pl-6 flex flex-col min-h-0">
          {selectedItem ? (
            <div className="flex-1 overflow-y-auto">
              <FeedbackDetail item={selectedItem} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[13px] text-text-tertiary">Select a feedback entry to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer stats */}
      <div className="flex gap-8 pt-5 mt-5 border-t border-border">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-text-tertiary">Total</span>
          <span className="text-[12px] font-medium text-text-secondary tabular-nums">{feedback.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-text-tertiary">Open</span>
          <span className="text-[12px] font-medium text-text-secondary tabular-nums">{openCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-text-tertiary">Resolved</span>
          <span className="text-[12px] font-medium text-text-secondary tabular-nums">{resolvedCount}</span>
        </div>
      </div>
    </>
  )
}
