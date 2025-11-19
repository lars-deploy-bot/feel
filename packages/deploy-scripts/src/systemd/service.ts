import { execSync, spawnSync } from "child_process"
import { DeploymentError } from "../orchestration/errors"

export async function reloadSystemd() {
  const result = spawnSync("systemctl", ["daemon-reload"])
  if (result.error || result.status !== 0) {
    throw new DeploymentError("systemctl daemon-reload failed")
  }
}

export async function startService(serviceName: string) {
  const result = spawnSync("systemctl", ["start", serviceName])
  if (result.error || result.status !== 0) {
    throw new DeploymentError(`systemctl start ${serviceName} failed`)
  }
}

export async function verifyService(serviceName: string): Promise<boolean> {
  const statusResult = spawnSync("systemctl", ["is-active", "--quiet", serviceName])
  if (statusResult.error) {
    const logs = execSync(`journalctl -u ${serviceName} --lines=10`).toString()
    throw new DeploymentError(`systemd service failed to start\n${logs}`)
  }
  return true
}

export async function stopPM2Service(domain: string) {
  const pm2Name = domain.replace(/\./g, "-")
  try {
    spawnSync("pm2", ["delete", pm2Name], { stdio: "pipe" })
  } catch {
    // Ignore if process doesn't exist
  }
}

export async function reloadCaddy() {
  const result = spawnSync("systemctl", ["reload", "caddy"])
  if (result.error || result.status !== 0) {
    throw new DeploymentError("Caddy reload failed")
  }
}

export function getServiceName(slug: string): string {
  return `site@${slug}.service`
}
