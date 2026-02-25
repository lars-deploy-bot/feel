import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import type { OrgMember } from "../orgs.types"

interface OrgMembersListProps {
  members: OrgMember[]
  onAdd: () => void
  onRemove: (userId: string) => void
}

function roleBadgeVariant(role: string) {
  if (role === "owner") return "accent" as const
  if (role === "admin") return "warning" as const
  return "default" as const
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
        <p className="text-[12px] text-text-tertiary py-3">No members yet</p>
      ) : (
        <div className="space-y-0.5">
          {members.map(member => (
            <div key={member.user_id} className="flex items-center justify-between py-2 group">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-text-primary truncate">{member.display_name ?? member.email}</span>
                  <Badge variant={roleBadgeVariant(member.role)}>{member.role}</Badge>
                </div>
                {member.display_name && <p className="text-[11px] text-text-tertiary mt-0.5">{member.email}</p>}
              </div>

              {member.role !== "owner" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-danger hover:text-danger"
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
