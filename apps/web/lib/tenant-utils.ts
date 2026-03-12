import { PATHS } from "@webalive/shared"

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Tenant ID utilities for image storage
 */

export function workspaceToTenantId(workspace: string): string {
  const sitesRoot = PATHS.SITES_ROOT.trim()
  if (!sitesRoot) {
    throw new Error("PATHS.SITES_ROOT must be configured before deriving image tenant IDs")
  }

  const normalizedWorkspace = workspace.replace(/\/+$/, "")
  const normalizedSitesRoot = sitesRoot.replace(/\/+$/, "")
  const pattern = new RegExp(`^${escapeRegExp(normalizedSitesRoot)}/([^/]+)(?:/|$)`)
  const match = normalizedWorkspace.match(pattern)

  if (!match?.[1]) {
    throw new Error(`Failed to derive tenant ID from workspace path outside configured sites root: ${workspace}`)
  }

  return match[1]
}
