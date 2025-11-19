import { execSync, spawnSync } from "child_process"
import { DeploymentError } from "../orchestration/errors"

export async function ensureUser(username: string, homeDir: string) {
  try {
    execSync(`id ${username}`, { stdio: "pipe" })
    return
  } catch {
    // User doesn't exist, create it
  }

  const result = spawnSync("useradd", ["--system", "--home-dir", homeDir, "--shell", "/usr/sbin/nologin", username])
  if (result.error || result.status !== 0) {
    throw new DeploymentError(`Failed to create system user ${username}`)
  }
}

export function domainToSlug(domain: string): string {
  return domain.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
}

export function getSiteUsername(domain: string): string {
  return `site-${domainToSlug(domain)}`
}
