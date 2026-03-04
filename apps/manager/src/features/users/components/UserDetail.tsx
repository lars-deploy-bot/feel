import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Badge } from "@/components/ui/Badge"
import { cn } from "@/lib/cn"
import { useRoute } from "@/lib/useRoute"
import type { UserDevice, UserLocation } from "../users.api"
import { usersApi } from "../users.api"
import type { User } from "../users.types"
import { avatarColor, formatDate, relativeTime, roleBadgeVariant, statusVariant } from "../users.utils"
import { ModelAccess } from "./ModelAccess"

interface UserDetailProps {
  user: User
}

function formatDevice(d: UserDevice): string {
  const browser = d.browser_version ? `${d.browser} ${d.browser_version}` : d.browser
  const os = d.os_version ? `${d.os} ${d.os_version}` : d.os
  return [browser, os].filter(Boolean).join(" · ")
}

function formatLocation(l: UserLocation): string {
  return [l.city, l.region, l.country].filter(Boolean).join(", ")
}

export function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <h4 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-2">
      {label}
      {count !== undefined && ` (${count})`}
    </h4>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-[11px] text-text-tertiary w-20 flex-shrink-0">{label}</span>
      <span className="text-[12px] text-text-primary">{value}</span>
    </div>
  )
}

export function UserDetail({ user }: UserDetailProps) {
  const displayName = user.display_name ?? user.email ?? "Unknown"
  const { navigate } = useRoute()
  const queryClient = useQueryClient()

  const { data: profile } = useQuery({
    queryKey: ["users", user.user_id, "profile"],
    queryFn: () => usersApi.profile(user.user_id),
    staleTime: 120_000,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-[13px] font-semibold",
            avatarColor(displayName),
          )}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[15px] font-semibold text-text-primary truncate">{displayName}</h2>
            <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
          </div>
          {user.email && <p className="text-[12px] text-text-secondary mt-0.5">{user.email}</p>}
          <p className="text-[11px] text-text-tertiary font-mono mt-0.5 select-all">{user.user_id}</p>
          <p className="text-[11px] text-text-tertiary mt-0.5">
            Created {formatDate(user.created_at)}
            {user.updated_at && ` · Updated ${formatDate(user.updated_at)}`}
          </p>
          <p className="text-[11px] text-text-tertiary mt-0.5">Last active: {relativeTime(user.last_active)}</p>
        </div>
      </div>

      {/* Locations */}
      {profile && profile.locations.length > 0 && (
        <div>
          <SectionHeader label="Locations" count={profile.locations.length} />
          <div className="space-y-1.5">
            {profile.locations.map((loc, i) => {
              const place = formatLocation(loc)
              return (
                <div key={place || i} className="py-0.5">
                  {place && <div className="text-[12px] text-text-primary">{place}</div>}
                  <div className="flex items-center gap-3">
                    {loc.timezone && <span className="text-[11px] text-text-tertiary">{loc.timezone}</span>}
                    <span className="text-[11px] text-text-tertiary ml-auto">{relativeTime(loc.last_seen)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Devices */}
      {profile && profile.devices.length > 0 && (
        <div>
          <SectionHeader label="Devices" count={profile.devices.length} />
          <div className="space-y-1.5">
            {profile.devices.map((dev, i) => {
              const desc = formatDevice(dev)
              return (
                <div key={desc || i} className="py-0.5">
                  {desc && <div className="text-[12px] text-text-primary">{desc}</div>}
                  <div className="flex items-center gap-3">
                    {dev.device_type && <span className="text-[11px] text-text-tertiary">{dev.device_type}</span>}
                    {dev.screen && <span className="text-[11px] text-text-tertiary">{dev.screen}</span>}
                    <span className="text-[11px] text-text-tertiary ml-auto">{relativeTime(dev.last_seen)}</span>
                  </div>
                </div>
              )
            })}
          </div>
          {profile.referrer && <InfoRow label="Referrer" value={profile.referrer} />}
        </div>
      )}

      {/* Chat Sessions */}
      <div>
        <SectionHeader label="Chat Sessions" count={user.session_count} />
        {user.sessions.length === 0 ? (
          <p className="text-[12px] text-text-tertiary">No conversations</p>
        ) : (
          <div className="space-y-0.5">
            {user.sessions.map(s => (
              <div key={s.domain_hostname} className="flex items-center gap-2 py-1">
                <span className="w-1 h-1 rounded-full bg-text-tertiary/30 flex-shrink-0" />
                <span className="text-[13px] text-text-primary">{s.domain_hostname}</span>
                <Badge variant="default">
                  {s.session_count} session{s.session_count !== 1 ? "s" : ""}
                </Badge>
                <span className="text-[11px] text-text-tertiary ml-auto">{relativeTime(s.last_activity)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Model Access */}
      <ModelAccess
        key={user.user_id}
        userId={user.user_id}
        enabledModels={user.enabled_models}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["users"] })}
      />

      {/* Organizations */}
      <div>
        <SectionHeader label="Organizations" count={user.org_count} />
        {user.orgs.length === 0 ? (
          <p className="text-[12px] text-text-tertiary">No organizations</p>
        ) : (
          <div className="space-y-0.5">
            {user.orgs.map(org => (
              <div key={org.org_id} className="flex items-center gap-2 py-1">
                <span className="w-1 h-1 rounded-full bg-text-tertiary/30 flex-shrink-0" />
                <button
                  type="button"
                  onClick={() => navigate("organizations", { id: org.org_id })}
                  className="text-[13px] text-text-primary hover:text-accent transition-colors cursor-pointer"
                >
                  {org.name}
                </button>
                <Badge variant={roleBadgeVariant(org.role)}>{org.role}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
