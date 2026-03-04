import { dollarsToTokens, formatTokensAsDollars, TOKENS_PER_DOLLAR, tokensToDollars } from "@webalive/shared/constants"
import { useState } from "react"
import { Badge, type BadgeVariant } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { cn } from "@/lib/cn"
import type { Organization } from "../orgs.types"
import { OrgMembersList } from "./OrgMembersList"

interface OrgDetailProps {
  org: Organization
  onSaveCredits: (orgId: string, tokens: number) => Promise<void>
  onDelete: (orgId: string) => void
  onAddMember: (orgId: string) => void
  onRemoveMember: (orgId: string, userId: string) => void
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function OrgDetail({ org, onSaveCredits, onDelete, onAddMember, onRemoveMember }: OrgDetailProps) {
  const [editing, setEditing] = useState(false)
  const [dollars, setDollars] = useState("")
  const [saving, setSaving] = useState(false)
  const [dangerOpen, setDangerOpen] = useState(false)

  function startEdit() {
    setDollars(String(tokensToDollars(org.credits)))
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
  }

  async function saveEdit() {
    setSaving(true)
    try {
      await onSaveCredits(org.org_id, dollarsToTokens(Number.parseFloat(dollars) || 0))
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-[13px] font-semibold ${avatarColor(org.name)}`}
        >
          {org.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[15px] font-semibold text-text-primary truncate">{org.name}</h2>
            <Badge variant={creditsBadgeVariant(org.credits)}>{formatTokensAsDollars(org.credits)}</Badge>
          </div>
          <p className="text-[11px] text-text-tertiary font-mono mt-0.5 select-all">{org.org_id}</p>
          <p className="text-[11px] text-text-tertiary mt-0.5">
            Created {formatDate(org.created_at)}
            {org.updated_at && ` · Updated ${formatDate(org.updated_at)}`}
          </p>
        </div>
      </div>

      {/* Balance */}
      <div>
        <h4 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-2">Balance</h4>
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={dollars}
              onChange={e => setDollars(e.target.value)}
              className="w-32"
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter") saveEdit()
                if (e.key === "Escape") cancelEdit()
              }}
            />
            <Button size="sm" variant="primary" onClick={saveEdit} loading={saving}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-[20px] font-semibold text-text-primary tabular-nums">
              {formatTokensAsDollars(org.credits)}
            </span>
            <Button size="sm" variant="ghost" onClick={startEdit}>
              Edit
            </Button>
          </div>
        )}
      </div>

      {/* Projects */}
      <div>
        <h4 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-2">Projects</h4>
        {org.domains.length === 0 ? (
          <p className="text-[12px] text-text-tertiary">No projects assigned</p>
        ) : (
          <div className="space-y-0.5">
            {org.domains.map(domain => (
              <div key={domain.domain_id} className="flex items-center gap-2 py-1">
                <span className="w-1 h-1 rounded-full bg-text-tertiary/30 flex-shrink-0" />
                <button
                  type="button"
                  onClick={() => window.open(`https://${domain.hostname}`, "_blank")}
                  className="text-[13px] text-text-primary hover:text-accent transition-colors cursor-pointer"
                >
                  {domain.hostname}
                </button>
                {domain.port && <span className="text-[11px] text-text-tertiary font-mono">:{domain.port}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Members */}
      <OrgMembersList
        members={org.members}
        onAdd={() => onAddMember(org.org_id)}
        onRemove={userId => onRemoveMember(org.org_id, userId)}
      />

      {/* Danger Zone */}
      <div className="pt-4 border-t border-border">
        <button
          type="button"
          onClick={() => setDangerOpen(!dangerOpen)}
          className="flex items-center gap-1.5 cursor-pointer group"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className={cn("text-danger/60 transition-transform duration-100", dangerOpen && "rotate-90")}
          >
            <path
              d="M4.5 3L7.5 6L4.5 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[11px] font-medium text-danger/60 uppercase tracking-wider group-hover:text-danger transition-colors">
            Danger Zone
          </span>
        </button>
        {dangerOpen && (
          <div className="mt-3">
            <Button size="sm" variant="danger" onClick={() => onDelete(org.org_id)}>
              Delete Organization
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
