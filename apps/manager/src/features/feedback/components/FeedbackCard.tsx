import { Badge, type BadgeVariant } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import type { FeedbackItem } from "../feedback.types"
import { useUpdateFeedback } from "../hooks/useFeedback"
import { FeedbackActions } from "./FeedbackActions"

interface FeedbackCardProps {
  item: FeedbackItem
  selected: boolean
  onSelect: (id: string) => void
}

function formatDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function statusBadge(item: FeedbackItem): { label: string; variant: BadgeVariant } {
  if (item.closed_at) return { label: "Resolved", variant: "success" }
  if (item.fixed_email_sent) return { label: "Fixed", variant: "success" }
  if (item.aware_email_sent) return { label: "Aware", variant: "warning" }
  if (item.github_issue_url) return { label: "Issue", variant: "accent" }
  return { label: "Open", variant: "default" }
}

export function FeedbackCard({ item, selected, onSelect }: FeedbackCardProps) {
  const badge = statusBadge(item)
  const isClosed = !!item.closed_at

  return (
    <button
      type="button"
      onClick={() => onSelect(item.feedback_id)}
      className={`w-full text-left px-4 py-3 border-b border-border transition-colors duration-100 cursor-pointer ${
        selected ? "bg-surface-secondary" : "hover:bg-surface-secondary/50"
      } ${isClosed ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[13px] font-medium text-text-primary truncate">{item.workspace ?? "unknown"}</span>
          {item.email && <span className="text-[11px] text-text-tertiary truncate max-w-[180px]">{item.email}</span>}
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      <p className="text-[12px] text-text-secondary line-clamp-2 break-words">{item.content}</p>
      <span className="text-[11px] text-text-tertiary mt-1 block">{formatDate(item.created_at)}</span>
    </button>
  )
}

interface FeedbackDetailProps {
  item: FeedbackItem
}

export function FeedbackDetail({ item }: FeedbackDetailProps) {
  const badge = statusBadge(item)
  const isClosed = !!item.closed_at
  const { mutate, isPending } = useUpdateFeedback()

  function toggleClosed() {
    if (isClosed) {
      mutate({ feedbackId: item.feedback_id, updates: { closed_at: null, status: "open" } })
    } else {
      mutate({ feedbackId: item.feedback_id, updates: { closed_at: new Date().toISOString(), status: "closed" } })
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-[14px] font-semibold text-text-primary">{item.workspace ?? "unknown"}</h2>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-text-tertiary">
            {item.email && <span>{item.email}</span>}
            {item.email && item.created_at && <span>·</span>}
            {item.created_at && <span>{formatDate(item.created_at)}</span>}
          </div>
          {item.user_id && (
            <span className="text-[11px] text-text-tertiary font-mono mt-0.5 block">{item.user_id}</span>
          )}
          {item.closed_at && (
            <span className="text-[11px] text-text-tertiary mt-1 block">Resolved {formatDate(item.closed_at)}</span>
          )}
        </div>
        <Button size="sm" variant={isClosed ? "secondary" : "danger"} onClick={toggleClosed} loading={isPending}>
          {isClosed ? "Reopen" : "Mark resolved"}
        </Button>
      </div>

      {/* Content */}
      <div className="text-[13px] text-text-primary whitespace-pre-wrap break-words bg-surface-secondary/50 rounded-lg p-4">
        {item.content}
      </div>

      {/* Actions */}
      <div className="border-t border-border pt-4">
        <FeedbackActions item={item} />
      </div>
    </div>
  )
}
