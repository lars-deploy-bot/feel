import { existsSync } from "node:fs"
import path from "node:path"
import type { ExecutionMode } from "@webalive/database"
import { PATHS } from "@webalive/shared"
import { getE2bScratchSiteRoot } from "@/lib/sandbox/e2b-workspace"
import { WORKSPACE_BASE } from "./config"

export function getSystemdSiteWorkspaceRoot(domain: string): string {
  return path.resolve(WORKSPACE_BASE, domain)
}

export function getSiteWorkspaceRoot(domain: string, executionMode: ExecutionMode): string {
  return executionMode === "e2b" ? getE2bScratchSiteRoot(domain) : getSystemdSiteWorkspaceRoot(domain)
}

export function getSiteWorkspaceCandidates(domain: string): string[] {
  const candidates = [getSystemdSiteWorkspaceRoot(domain)]
  if (PATHS.E2B_SCRATCH_ROOT) {
    candidates.push(getE2bScratchSiteRoot(domain))
  }
  return [...new Set(candidates)]
}

export function siteWorkspaceExists(domain: string): boolean {
  return getSiteWorkspaceCandidates(domain).some(candidate => existsSync(candidate))
}
