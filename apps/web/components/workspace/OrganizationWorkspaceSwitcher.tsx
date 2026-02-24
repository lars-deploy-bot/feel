"use client"

import { ChevronDown } from "lucide-react"
import { useCallback, useMemo, useRef, useState } from "react"
import type { Organization } from "@/lib/api/types"
import { useOrganizations } from "@/lib/hooks/useOrganizations"
import { useWorkspacesQuery } from "@/lib/hooks/useSettingsQueries"
import { useSelectedOrgId, useWorkspaceActions } from "@/lib/stores/workspaceStore"
import { SUPERADMIN } from "@webalive/shared"
import { SwitcherDropdown } from "./SwitcherDropdown"

// ─── Accessors (stable references, defined outside component) ────────────────

const getOrgKey = (org: Organization) => org.org_id
const getOrgLabel = (org: Organization) => org.name
const getWsKey = (ws: string) => ws
const getWsLabel = (ws: string) => ws

// ─── Component ───────────────────────────────────────────────────────────────

interface OrganizationWorkspaceSwitcherProps {
  workspace: string | null
}

export function OrganizationWorkspaceSwitcher({ workspace }: OrganizationWorkspaceSwitcherProps) {
  const { organizations } = useOrganizations()
  const selectedOrgId = useSelectedOrgId()
  const { setCurrentWorkspace, setSelectedOrg } = useWorkspaceActions()

  const org = organizations.find(o => o.org_id === selectedOrgId) ?? organizations[0]

  // Hooks must be called before early return — query with empty string is a no-op
  const { data: workspacesData } = useWorkspacesQuery(org?.org_id ?? "")
  const workspaces = useMemo(() => {
    const ws = workspacesData?.workspaces ?? []
    return ws.toSorted((a, b) => {
      if (a === SUPERADMIN.WORKSPACE_NAME) return -1
      if (b === SUPERADMIN.WORKSPACE_NAME) return 1
      return 0
    })
  }, [workspacesData?.workspaces])

  const [orgOpen, setOrgOpen] = useState(false)
  const [wsOpen, setWsOpen] = useState(false)
  const orgTriggerRef = useRef<HTMLButtonElement>(null)
  const wsTriggerRef = useRef<HTMLButtonElement>(null)

  const closeOrg = useCallback(() => setOrgOpen(false), [])
  const closeWs = useCallback(() => setWsOpen(false), [])

  const handleOrgSelect = useCallback(
    (selected: Organization) => {
      setSelectedOrg(selected.org_id)
      if (selected.org_id !== org?.org_id) {
        setCurrentWorkspace(null, selected.org_id)
      }
      setOrgOpen(false)
    },
    [setSelectedOrg, setCurrentWorkspace, org?.org_id],
  )

  const handleWsSelect = useCallback(
    (ws: string) => {
      if (!org) return
      setCurrentWorkspace(ws, org.org_id)
      setWsOpen(false)
    },
    [setCurrentWorkspace, org],
  )

  // No org = nothing to show (orgs still loading, or user has none)
  if (!org) return null

  const showOrgChevron = organizations.length > 1
  const showWsChevron = !workspace || workspaces.length > 1

  return (
    <div className="flex items-center text-sm">
      {/* Org trigger */}
      <button
        ref={orgTriggerRef}
        type="button"
        onClick={() => {
          setOrgOpen(prev => !prev)
          setWsOpen(false)
        }}
        className="flex items-center gap-1.5 text-black/35 dark:text-white/35 hover:text-black/55 dark:hover:text-white/55 transition-colors min-w-[120px]"
      >
        <span>{org.name}</span>
        {showOrgChevron && <ChevronDown size={11} strokeWidth={2} className="shrink-0 opacity-50" />}
      </button>

      <span className="text-black/15 dark:text-white/15 shrink-0 select-none mx-4">/</span>

      {/* Workspace trigger */}
      <button
        ref={wsTriggerRef}
        type="button"
        onClick={() => {
          setWsOpen(prev => !prev)
          setOrgOpen(false)
        }}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-[160px]"
      >
        <span
          className={`size-1.5 rounded-full shrink-0 ${workspace ? "bg-emerald-500" : "bg-black/10 dark:bg-white/10"}`}
        />
        <span
          className={
            workspace
              ? "text-black/80 dark:text-white/80 font-medium truncate"
              : "text-black/25 dark:text-white/25 truncate"
          }
        >
          {workspace ?? "Pick a workspace"}
        </span>
        {showWsChevron && (
          <ChevronDown size={11} strokeWidth={2} className="text-black/20 dark:text-white/20 shrink-0" />
        )}
      </button>

      {/* Dropdowns */}
      {orgOpen && showOrgChevron && (
        <SwitcherDropdown
          triggerRef={orgTriggerRef}
          items={organizations}
          activeItem={org}
          getKey={getOrgKey}
          getLabel={getOrgLabel}
          placeholder="Find organization..."
          onSelect={handleOrgSelect}
          onClose={closeOrg}
        />
      )}

      {wsOpen && workspaces.length > 0 && (
        <SwitcherDropdown
          triggerRef={wsTriggerRef}
          items={workspaces}
          activeItem={workspace}
          getKey={getWsKey}
          getLabel={getWsLabel}
          placeholder="Find workspace..."
          onSelect={handleWsSelect}
          onClose={closeWs}
        />
      )}
    </div>
  )
}
