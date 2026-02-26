import { Badge } from "@/components/ui/Badge"
import { cn } from "@/lib/cn"
import type { User } from "../users.types"
import { avatarColor, relativeTime, statusVariant } from "../users.utils"

interface UserRowProps {
  user: User
  selected: boolean
  onSelect: (userId: string) => void
}

export function UserRow({ user, selected, onSelect }: UserRowProps) {
  const label = user.display_name ?? user.email ?? "Unknown"

  return (
    <button
      type="button"
      onClick={() => onSelect(user.user_id)}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-lg transition-colors duration-100 cursor-pointer",
        selected ? "bg-surface-secondary" : "hover:bg-surface-secondary/50",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-semibold",
            avatarColor(label),
          )}
        >
          {label.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-text-primary truncate">{label}</span>
            <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            {user.email && user.display_name && (
              <>
                <span className="text-[11px] text-text-tertiary truncate max-w-[140px]">{user.email}</span>
                <span className="text-[11px] text-text-tertiary/40 select-none">·</span>
              </>
            )}
            <span className="text-[11px] text-text-tertiary">
              {user.org_count} org{user.org_count !== 1 ? "s" : ""}
            </span>
            {user.session_count > 0 && (
              <>
                <span className="text-[11px] text-text-tertiary/40 select-none">·</span>
                <span className="text-[11px] text-text-tertiary">
                  {user.session_count} chat{user.session_count !== 1 ? "s" : ""}
                </span>
              </>
            )}
            <span className="text-[11px] text-text-tertiary/40 select-none">·</span>
            <span className="text-[11px] text-text-tertiary">{relativeTime(user.last_active)}</span>
          </div>
        </div>
      </div>
    </button>
  )
}
