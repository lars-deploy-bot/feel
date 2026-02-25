import { useState } from "react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/cn"
import type { Organization } from "../orgs.types"
import { OrgMembersList } from "./OrgMembersList"

interface OrgCardProps {
  org: Organization
  onEditCredits: (orgId: string, currentCredits: number) => void
  onDelete: (orgId: string) => void
  onAddMember: (orgId: string) => void
  onRemoveMember: (orgId: string, userId: string) => void
}

function creditsBadgeVariant(credits: number) {
  if (credits <= 0) return "danger" as const
  if (credits < 1) return "warning" as const
  return "success" as const
}

export function OrgCard({ org, onEditCredits, onDelete, onAddMember, onRemoveMember }: OrgCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={cn(
        "bg-surface rounded-card border border-border",
        "shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        "transition-shadow duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
      )}
    >
      {/* Card Header */}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <button type="button" onClick={() => setExpanded(!expanded)} className="group text-left cursor-pointer">
              <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                {org.name}
              </h3>
            </button>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant={creditsBadgeVariant(org.credits)}>${org.credits.toFixed(2)}</Badge>
              <span className="text-xs text-text-tertiary">
                {org.member_count} member{org.member_count !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-text-tertiary">
                {org.domain_count} project{org.domain_count !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button size="sm" variant="ghost" onClick={() => onEditCredits(org.org_id, org.credits)}>
              Credits
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(org.org_id)}>
              Delete
            </Button>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className={cn(
                "w-7 h-7 flex items-center justify-center rounded-lg text-text-tertiary",
                "hover:bg-surface-tertiary transition-all cursor-pointer",
                expanded && "rotate-180",
              )}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-2 mt-2.5">
          <span className="text-[11px] text-text-tertiary">
            Created{" "}
            {new Date(org.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <span className="text-text-tertiary">·</span>
          <span className="text-[11px] text-text-tertiary font-mono">{org.org_id.slice(0, 8)}</span>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-border">
          {/* Domains */}
          <div className="px-5 py-4">
            <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">Projects</h4>
            {org.domains.length === 0 ? (
              <div className="flex items-center justify-center py-6 border border-dashed border-border rounded-lg">
                <p className="text-xs text-text-tertiary">No projects assigned</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {org.domains.map(domain => (
                  <div
                    key={domain.domain_id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-secondary"
                  >
                    <div>
                      <button
                        type="button"
                        onClick={() => window.open(`https://${domain.hostname}`, "_blank")}
                        className="text-sm font-medium text-accent hover:underline cursor-pointer"
                      >
                        {domain.hostname}
                      </button>
                      {domain.port && (
                        <span className="ml-2 text-[11px] text-text-tertiary font-mono">:{domain.port}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Members */}
          <div className="px-5 py-4 border-t border-border-subtle">
            <OrgMembersList
              members={org.members}
              onAdd={() => onAddMember(org.org_id)}
              onRemove={userId => onRemoveMember(org.org_id, userId)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
