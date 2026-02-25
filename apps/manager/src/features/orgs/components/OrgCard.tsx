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
    <div className="py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-[13px] font-medium text-text-primary hover:text-text-secondary transition-colors cursor-pointer"
            >
              {org.name}
            </button>
            <Badge variant={creditsBadgeVariant(org.credits)}>${org.credits.toFixed(2)}</Badge>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-text-tertiary">
              {org.member_count} member{org.member_count !== 1 ? "s" : ""}
            </span>
            <span className="text-[11px] text-text-tertiary">
              {org.domain_count} project{org.domain_count !== 1 ? "s" : ""}
            </span>
            <span className="text-[11px] text-text-tertiary font-mono">{org.org_id.slice(0, 8)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Button size="sm" variant="ghost" onClick={() => onEditCredits(org.org_id, org.credits)}>
            Credits
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-danger hover:text-danger"
            onClick={() => onDelete(org.org_id)}
          >
            Delete
          </Button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={cn(
              "w-7 h-7 flex items-center justify-center rounded-md text-text-tertiary",
              "hover:bg-surface-secondary transition-all duration-100 cursor-pointer",
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

      {expanded && (
        <div className="mt-4 ml-0 space-y-4">
          <div>
            <h4 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-2">Projects</h4>
            {org.domains.length === 0 ? (
              <p className="text-[12px] text-text-tertiary py-3">No projects assigned</p>
            ) : (
              <div className="space-y-1">
                {org.domains.map(domain => (
                  <div key={domain.domain_id} className="flex items-center gap-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => window.open(`https://${domain.hostname}`, "_blank")}
                      className="text-[13px] text-accent hover:underline cursor-pointer"
                    >
                      {domain.hostname}
                    </button>
                    {domain.port && <span className="text-[11px] text-text-tertiary font-mono">:{domain.port}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
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
