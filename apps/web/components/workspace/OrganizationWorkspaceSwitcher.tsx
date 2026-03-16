"use client"

import { SUPERADMIN_WORKSPACE_NAME } from "@webalive/shared/constants"
import { ChevronDown, Shield } from "lucide-react"
import { useCallback, useMemo, useRef, useState } from "react"
import toast from "react-hot-toast"
import { trackCreateProjectClicked, trackCreateTeamClicked } from "@/lib/analytics/events"
import type { Organization } from "@/lib/api/types"
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
  /** Minimal mode: shows only a clean project name (first segment of domain, capitalized). Click opens switcher. */
  minimal?: boolean
}

/** Derive a clean project name: "larry.alive.best" → "Larry", "alive" → "Alive" */
function deriveProjectName(domain: string): string {
  const first = domain.split(".")[0]
  return first.charAt(0).toUpperCase() + first.slice(1)
}

export function OrganizationWorkspaceSwitcher({
  workspace,
  compact,
  orgOnly,
  wsOnly,
  minimal,
}: OrganizationWorkspaceSwitcherProps) {
  const { organizations } = useOrganizations()
  const selectedOrgId = useSelectedOrgId()
  const { setCurrentWorkspace, setSelectedOrg } = useWorkspaceActions()

  const org = organizations.find(o => o.org_id === selectedOrgId) ?? organizations[0]

  // Hooks must be called before early return — query with empty string is a no-op
  const { data: workspacesData, isPending: wsLoading } = useWorkspacesQuery(org?.org_id ?? "")
  const workspaces = useMemo(() => {
    const ws = workspacesData?.workspaces ?? []
    return ws.toSorted((a, b) => {
      if (a === SUPERADMIN_WORKSPACE_NAME) return -1
      if (b === SUPERADMIN_WORKSPACE_NAME) return 1
      return 0
    })
  }, [workspacesData?.workspaces])
  const sandboxedSet = useMemo(() => new Set(workspacesData?.sandboxed ?? []), [workspacesData?.sandboxed])

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

  // If workspace doesn't belong to the selected org, treat as unselected
  // While loading, keep wsInOrg as the raw workspace to avoid "Select project" flash
  const wsInOrg = wsLoading ? workspace : workspace && workspaces.includes(workspace) ? workspace : null

  const showOrgChevron = organizations.length > 1
  const showWsChevron = !wsInOrg || workspaces.length > 1

  // Minimal layout: just the project name, click to switch
  if (minimal) {
    return (
      <div className="relative">
        <button
          ref={wsTriggerRef}
          type="button"
          onClick={() => setWsOpen(prev => !prev)}
          className="text-[13px] font-semibold text-black/40 dark:text-white/30 hover:text-black/60 dark:hover:text-white/50 bg-white dark:bg-[#1a1a1a] border border-emerald-400/30 dark:border-emerald-500/20 ring-1 ring-emerald-400/10 dark:ring-emerald-500/10 px-3 py-1 rounded-full transition-all select-none shrink-0"
        >
          {wsInOrg ? deriveProjectName(wsInOrg) : "Select project"}
        </button>

        {wsOpen && workspaces.length > 0 && (
          <SwitcherDropdown
            triggerRef={wsTriggerRef}
            items={workspaces}
            activeItem={wsInOrg}
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

  // Compact layout for sidebar
  if (compact) {
    return (
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        {/* Org trigger - small label */}
        {!wsOnly && (
          <button
            ref={orgTriggerRef}
            type="button"
            onClick={() => {
              setOrgOpen(prev => !prev)
              setWsOpen(false)
            }}
            className="flex items-center gap-1.5 text-[13px] font-medium text-black/50 dark:text-white/40 hover:text-black/70 dark:hover:text-white/60 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] px-2 py-1 rounded-lg transition-all truncate"
          >
            <span className="truncate">{org.name}</span>
            {showOrgChevron && <ChevronDown size={10} strokeWidth={2} className="shrink-0 opacity-50" />}
          </button>
        )}

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
            {wsInOrg && sandboxedSet.has(wsInOrg) ? (
              <Shield size={12} strokeWidth={2.5} className="shrink-0 text-emerald-500" />
            ) : (
              <span
                className={`size-1.5 rounded-full shrink-0 ${wsInOrg ? "bg-emerald-500" : "bg-black/10 dark:bg-white/10"}`}
              />
            )}
            <span
              className={`text-sm truncate ${
                wsInOrg ? "text-black/80 dark:text-white/80 font-medium" : "text-black/25 dark:text-white/25"
              }`}
            >
              {wsInOrg ?? "Select project"}
            </span>
            {showWsChevron && (
              <ChevronDown size={10} strokeWidth={2} className="text-black/20 dark:text-white/20 shrink-0" />
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
            activeItem={wsInOrg}
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
          {wsInOrg && sandboxedSet.has(wsInOrg) ? (
            <Shield size={12} strokeWidth={2.5} className="shrink-0 text-emerald-500" />
          ) : (
            <span
              className={`size-1.5 rounded-full shrink-0 ${wsInOrg ? "bg-emerald-500" : "bg-black/10 dark:bg-white/10"}`}
            />
          )}
          <span
            className={
              wsInOrg
                ? "text-black/80 dark:text-white/80 font-medium truncate"
                : "text-black/25 dark:text-white/25 truncate"
            }
          >
            {wsInOrg ?? "Select project"}
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
          activeItem={wsInOrg}
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
