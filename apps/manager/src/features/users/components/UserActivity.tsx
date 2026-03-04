import { useQuery } from "@tanstack/react-query"
import { Badge, type BadgeVariant } from "@/components/ui/Badge"
import { Spinner } from "@/components/ui/Spinner"
import { usersApi } from "../users.api"
import type { UserEvent } from "../users.types"

interface UserActivityProps {
  userId: string
}

/** Human-readable label for PostHog event names */
function eventLabel(event: string): string {
  // Strip $ prefix from autocaptured events
  const clean = event.startsWith("$") ? event.slice(1) : event
  return clean.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

function eventVariant(event: string): BadgeVariant {
  if (event === "$pageview") return "accent"
  if (event === "$pageleave") return "default"
  if (event === "$autocapture") return "default"
  if (event.startsWith("$exception")) return "danger"
  return "success"
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  const minutes = Math.floor(diff / 60_000)

  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function EventRow({ event }: { event: UserEvent }) {
  const props = event.properties
  const url = typeof props.$current_url === "string" ? props.$current_url : null
  const pathname = url ? new URL(url).pathname : null
  const browser = typeof props.$browser === "string" ? props.$browser : null
  const os = typeof props.$os === "string" ? props.$os : null

  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
      <div className="mt-0.5">
        <Badge variant={eventVariant(event.event)}>{eventLabel(event.event)}</Badge>
      </div>
      <div className="min-w-0 flex-1">
        {pathname && <p className="text-[12px] text-text-secondary truncate">{pathname}</p>}
        {browser && (
          <p className="text-[11px] text-text-tertiary">
            {browser}
            {os ? ` · ${os}` : ""}
          </p>
        )}
      </div>
      <span className="text-[11px] text-text-tertiary whitespace-nowrap flex-shrink-0">
        {formatTimestamp(event.timestamp)}
      </span>
    </div>
  )
}

export function UserActivity({ userId }: UserActivityProps) {
  const {
    data: events = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["users", userId, "events"],
    queryFn: () => usersApi.events(userId),
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="sm" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-[12px] text-text-tertiary">Failed to load activity</p>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-[12px] text-text-tertiary">No activity recorded</p>
      </div>
    )
  }

  return (
    <div>
      <h4 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-3">
        Recent Activity ({events.length})
      </h4>
      <div>
        {events.map(e => (
          <EventRow key={e.id} event={e} />
        ))}
      </div>
    </div>
  )
}
