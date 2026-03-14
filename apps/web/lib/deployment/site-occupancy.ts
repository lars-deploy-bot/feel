import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { getServiceName, PATHS } from "@webalive/shared"
import { buildSubdomain } from "@/lib/config"
import { getSiteWorkspaceCandidates } from "@/lib/site-workspace-registry"

export interface SiteOccupancy {
  occupied: boolean
  reason?: string
}

function toSystemSlug(domain: string): string {
  return domain.toLowerCase().replaceAll(".", "-")
}

function isSystemdServiceActive(serviceName: string): boolean {
  try {
    execFileSync("systemctl", ["is-active", "--quiet", serviceName], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

export function inspectSiteOccupancy(slug: string): SiteOccupancy {
  const fullDomain = buildSubdomain(slug)
  const systemSlug = toSystemSlug(fullDomain)
  const symlinkPath = path.join(PATHS.SITES_ROOT, systemSlug)
  const envFilePath = path.join(PATHS.SYSTEMD_ENV_DIR, `${systemSlug}.env`)
  const serviceName = getServiceName(systemSlug)

  if (getSiteWorkspaceCandidates(fullDomain).some(candidate => existsSync(candidate))) {
    return { occupied: true, reason: "workspace directory exists" }
  }

  if (existsSync(symlinkPath)) {
    return { occupied: true, reason: "workspace symlink exists" }
  }

  if (existsSync(envFilePath)) {
    return { occupied: true, reason: "systemd environment file exists" }
  }

  if (isSystemdServiceActive(serviceName)) {
    return { occupied: true, reason: "systemd service is still active" }
  }

  return { occupied: false }
}
