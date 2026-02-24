"use client"

import { useOrganizations } from "@/lib/hooks/useOrganizations"
import { useSelectedOrgId } from "@/lib/stores/workspaceStore"

function AliveDot() {
  return (
    <span className="relative flex shrink-0 size-3.5">
      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400/25 to-teal-400/25" />
      <span className="absolute inset-[2px] rounded-full bg-gradient-to-br from-emerald-500 to-teal-500" />
    </span>
  )
}

interface OrganizationWorkspaceSwitcherProps {
  workspace: string | null
}

export function OrganizationWorkspaceSwitcher({ workspace }: OrganizationWorkspaceSwitcherProps) {
  const { organizations } = useOrganizations()
  const selectedOrgId = useSelectedOrgId()

  const org = organizations.find(o => o.org_id === selectedOrgId) ?? organizations[0]
  const orgName = org?.name ?? null

  return (
    <div className="flex items-center gap-2 min-w-0 text-sm">
      {orgName && <span className="text-black/40 dark:text-white/40 truncate max-w-[140px]">{orgName}</span>}
      {orgName && workspace && <span className="text-black/15 dark:text-white/15 shrink-0 select-none">/</span>}
      {workspace && (
        <span className="flex items-center gap-1.5 min-w-0">
          <AliveDot />
          <span className="text-black/80 dark:text-white/80 font-medium truncate">{workspace}</span>
        </span>
      )}
    </div>
  )
}
