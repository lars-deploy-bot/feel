import { formatTokensAsDollars, TOKENS_PER_DOLLAR } from "@webalive/shared/constants"
import { Badge, type BadgeVariant } from "@/components/ui/Badge"
import { cn } from "@/lib/cn"
import type { Organization } from "../orgs.types"

interface OrgCardProps {
  org: Organization
  selected: boolean
  onSelect: (orgId: string) => void
}

const AVATAR_COLORS = [
  "bg-blue-50 text-blue-500",
  "bg-emerald-50 text-emerald-500",
  "bg-amber-50 text-amber-500",
  "bg-violet-50 text-violet-500",
  "bg-rose-50 text-rose-500",
  "bg-sky-50 text-sky-500",
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function creditsBadgeVariant(tokens: number): BadgeVariant {
  if (tokens <= 0) return "danger"
  if (tokens < TOKENS_PER_DOLLAR) return "warning"
  return "success"
}

export function OrgCard({ org, selected, onSelect }: OrgCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(org.org_id)}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-lg transition-colors duration-100 cursor-pointer",
        selected ? "bg-surface-secondary" : "hover:bg-surface-secondary/50",
      )}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className={cn(
            "w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[11px] font-semibold",
            avatarColor(org.name),
          )}
        >
          {org.name.charAt(0).toUpperCase()}
        </div>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-text-primary truncate">{org.name}</span>
            <Badge variant={creditsBadgeVariant(org.credits)}>{formatTokensAsDollars(org.credits)}</Badge>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[11px] text-text-tertiary">
              {org.member_count} member{org.member_count !== 1 ? "s" : ""}
            </span>
            <span className="text-[11px] text-text-tertiary/40 select-none">·</span>
            <span className="text-[11px] text-text-tertiary">
              {org.domain_count} project{org.domain_count !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}
