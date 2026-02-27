"use client"

import { SUPERADMIN } from "@webalive/shared"
import { ChevronDown } from "lucide-react"
import toast from "react-hot-toast"
import { useCallback, useMemo, useRef, useState } from "react"
import type { Organization } from "@/lib/api/types"
import { trackCreateProjectClicked, trackCreateTeamClicked } from "@/lib/analytics/events"
import { useOrganizations } from "@/lib/hooks/useOrganizations"
import { useWorkspacesQuery } from "@/lib/hooks/useSettingsQueries"
import { useSelectedOrgId, useWorkspaceActions } from "@/lib/stores/workspaceStore"
import { SwitcherDropdown } from "./SwitcherDropdown"

// ─── Accessors (stable references, defined outside component) ────────────────

const getOrgKey = (org: Organization) => org.org_id
const getOrgLabel = (org: Organization) => org.name
const getWsKey = (ws: string) => ws
const getWsLabel = (ws: string) => ws

// ─── Component ───────────────────────────────────────────────────────────────

interface OrganizationWorkspaceSwitcherProps {
  workspace: string | null
  /** Compact mode for sidebar: stacks org above workspace */
  compact?: boolean
  /** Only show org selector, hide workspace picker */
  orgOnly?: boolean
  /** Only show workspace selector, hide org picker */
  wsOnly?: boolean
}

export function OrganizationWorkspaceSwitcher({
  workspace,
  compact,
  orgOnly,
  wsOnly,
}: OrganizationWorkspaceSwitcherProps) {
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

  const handleCreateTeam = useCallback(() => {
    trackCreateTeamClicked()
    toast("Coming soon", { icon: "→" })
    setOrgOpen(false)
  }, [])

  const handleCreateProject = useCallback(() => {
    trackCreateProjectClicked()
    toast("Please contact your administrator")
    setWsOpen(false)
  }, [])

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

  // Compact layout for sidebar
  if (compact) {
    return (
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        {/* Org trigger - small label */}
        <button
          ref={orgTriggerRef}
          type="button"
          onClick={() => {
            setOrgOpen(prev => !prev)
            setWsOpen(false)
          }}
          className="flex items-center gap-1 text-[11px] text-black/35 dark:text-white/35 hover:text-black/55 dark:hover:text-white/55 transition-colors truncate"
        >
          <span className="truncate">{org.name}</span>
          {showOrgChevron && <ChevronDown size={10} strokeWidth={2} className="shrink-0 opacity-50" />}
        </button>

        {/* Workspace trigger - main label */}
        {!orgOnly && (
          <button
            ref={wsTriggerRef}
            type="button"
            onClick={() => {
              setWsOpen(prev => !prev)
              setOrgOpen(false)
            }}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity truncate"
          >
            <span
              className={`size-1.5 rounded-full shrink-0 ${workspace ? "bg-emerald-500" : "bg-black/10 dark:bg-white/10"}`}
            />
            <span
              className={`text-sm truncate ${
                workspace ? "text-black/80 dark:text-white/80 font-medium" : "text-black/25 dark:text-white/25"
              }`}
            >
              {workspace ?? "Pick a project"}
            </span>
            {showWsChevron && (
              <ChevronDown size={10} strokeWidth={2} className="text-black/20 dark:text-white/20 shrink-0" />
            )}
          </button>
        )}

        {/* Dropdowns */}
        {orgOpen && showOrgChevron && (
          <SwitcherDropdown
            triggerRef={orgTriggerRef}
            items={organizations}
            activeItem={org}
            getKey={getOrgKey}
            getLabel={getOrgLabel}
            placeholder="Find Team…"
            onSelect={handleOrgSelect}
            onClose={closeOrg}
            footerAction={{ label: "Create Team", onClick: handleCreateTeam }}
          />
        )}

        {!orgOnly && wsOpen && workspaces.length > 0 && (
          <SwitcherDropdown
            triggerRef={wsTriggerRef}
            items={workspaces}
            activeItem={workspace}
            getKey={getWsKey}
            getLabel={getWsLabel}
            placeholder="Find Project…"
            onSelect={handleWsSelect}
            onClose={closeWs}
            footerAction={{ label: "Create Project", onClick: handleCreateProject }}
          />
        )}
      </div>
    )
  }

  // Default horizontal layout (for top bar usage)
  return (
    <div className="flex items-center text-sm">
      {/* Org trigger */}
      {!wsOnly && (
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
      )}

      {!wsOnly && !orgOnly && <span className="text-black/15 dark:text-white/15 shrink-0 select-none mx-4">/</span>}

      {/* Workspace trigger */}
      {!orgOnly && (
        <button
          ref={wsTriggerRef}
          type="button"
          onClick={() => {
            setWsOpen(prev => !prev)
            setOrgOpen(false)
          }}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
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
            {workspace ?? "Pick a project"}
          </span>
          {showWsChevron && (
            <ChevronDown size={11} strokeWidth={2} className="text-black/20 dark:text-white/20 shrink-0" />
          )}
        </button>
      )}

      {/* Dropdowns */}
      {!wsOnly && orgOpen && showOrgChevron && (
        <SwitcherDropdown
          triggerRef={orgTriggerRef}
          items={organizations}
          activeItem={org}
          getKey={getOrgKey}
          getLabel={getOrgLabel}
          placeholder="Find Team…"
          onSelect={handleOrgSelect}
          onClose={closeOrg}
          footerAction={{ label: "Create Team", onClick: handleCreateTeam }}
        />
      )}

      {!orgOnly && wsOpen && workspaces.length > 0 && (
        <SwitcherDropdown
          triggerRef={wsTriggerRef}
          items={workspaces}
          activeItem={workspace}
          getKey={getWsKey}
          getLabel={getWsLabel}
          placeholder="Find Project…"
          onSelect={handleWsSelect}
          onClose={closeWs}
          footerAction={{ label: "Create Project", onClick: handleCreateProject }}
        />
      )}
    </div>
  )
}
