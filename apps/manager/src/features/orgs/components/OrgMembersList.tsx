import { Badge, type BadgeVariant } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import type { OrgMember } from "../orgs.types"

interface OrgMembersListProps {
  members: OrgMember[]
  onAdd: () => void
  onRemove: (userId: string) => void
}

const MEMBER_COLORS = [
  "bg-slate-100 text-slate-500",
  "bg-zinc-100 text-zinc-500",
  "bg-stone-100 text-stone-500",
  "bg-neutral-100 text-neutral-500",
]

function memberColor(email: string): string {
  let hash = 0
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash)
  }
  return MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length]
}

function memberInitial(member: OrgMember): string {
  const name = member.display_name ?? member.email
  return name.charAt(0).toUpperCase()
}

function formatJoined(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  const now = new Date()
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function roleBadgeVariant(role: string): BadgeVariant {
  if (role === "owner") return "accent"
  if (role === "admin") return "warning"
  return "default"
}

export function OrgMembersList({ members, onAdd, onRemove }: OrgMembersListProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">Members</h4>
        <Button size="sm" variant="ghost" onClick={onAdd}>
          Add
        </Button>
      </div>

      {members.length === 0 ? (
        <p className="text-[12px] text-text-tertiary">No members yet</p>
      ) : (
        <div className="space-y-0.5">
          {members.map(member => (
            <div key={member.user_id} className="flex items-center gap-2.5 py-1.5 group/member">
              <div
                className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-medium ${memberColor(member.email)}`}
              >
                {memberInitial(member)}
              </div>
              <div className="min-w-0 flex-1 flex items-center gap-2">
                <span className="text-[13px] text-text-primary truncate">{member.display_name ?? member.email}</span>
                <Badge variant={roleBadgeVariant(member.role)}>{member.role}</Badge>
                {member.display_name && (
                  <span className="text-[11px] text-text-tertiary truncate hidden sm:inline">{member.email}</span>
                )}
                {member.created_at && (
                  <span className="text-[11px] text-text-tertiary/60 hidden sm:inline">
                    {formatJoined(member.created_at)}
                  </span>
                )}
              </div>

              {member.role !== "owner" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="opacity-0 group-hover/member:opacity-100 transition-opacity text-danger hover:text-danger"
                  onClick={() => onRemove(member.user_id)}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
