import { exec } from "node:child_process"
import { promisify } from "node:util"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { addCorsHeaders } from "@/lib/cors-utils"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { loadDomainPasswords } from "@/types/guards/api"

const execAsync = promisify(exec)

interface DomainStatus {
  domain: string
  portListening: boolean
  httpAccessible: boolean
  httpsAccessible: boolean
  systemdServiceExists: boolean
  systemdServiceRunning: boolean
  caddyConfigured: boolean
  siteDirectoryExists: boolean
  lastChecked: number
}

async function checkPortListening(port: number): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`ss -ln | grep -E ':${port}\\s'`)
    return stdout.trim().length > 0
  } catch {
    return false
  }
}

async function checkHttpAccessible(domain: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const response = await fetch(`http://${domain}`, {
      signal: controller.signal,
      redirect: "manual",
    })

    clearTimeout(timeout)
    return response.status < 500
  } catch {
    return false
  }
}

async function checkHttpsAccessible(domain: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const response = await fetch(`https://${domain}`, {
      signal: controller.signal,
      redirect: "manual",
    })

    clearTimeout(timeout)
    return response.status < 500
  } catch {
    return false
  }
}

async function checkSystemdService(domain: string): Promise<{ exists: boolean; running: boolean }> {
  const serviceName = `site@${domain.replace(/\./g, "-")}.service`

  try {
    const { stdout: statusOutput } = await execAsync(
      `systemctl is-active ${serviceName} 2>/dev/null || echo "inactive"`,
    )
    const running = statusOutput.trim() === "active"

    try {
      await execAsync(`systemctl status ${serviceName} 2>/dev/null`)
      return { exists: true, running }
    } catch {
      return { exists: running, running }
    }
  } catch {
    return { exists: false, running: false }
  }
}

async function checkCaddyConfigured(domain: string): Promise<boolean> {
  try {
    const caddyfilePath = "/root/webalive/claude-bridge/Caddyfile"
    const { stdout } = await execAsync(`grep -q "^${domain} {" ${caddyfilePath} && echo "found" || echo "missing"`)
    return stdout.trim() === "found"
  } catch {
    return false
  }
}

async function checkSiteDirectory(domain: string): Promise<boolean> {
  try {
    const possiblePaths = [
      `/srv/webalive/sites/${domain}`,
      `/srv/webalive/sites/${domain.replace(/\./g, "-")}`,
      `/root/webalive/sites/${domain}`,
    ]

    for (const path of possiblePaths) {
      const { stdout } = await execAsync(`test -d ${path} && echo "exists" || echo "missing"`)
      if (stdout.trim() === "exists") {
        return true
      }
    }

    return false
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")
  const jar = await cookies()

  if (!jar.get("manager_session")) {
    const requestId = crypto.randomUUID()
    const res = NextResponse.json(
      {
        ok: false,
        error: ErrorCodes.UNAUTHORIZED,
        message: getErrorMessage(ErrorCodes.UNAUTHORIZED),
        requestId,
      },
      { status: 401 },
    )
    addCorsHeaders(res, origin)
    return res
  }

  const domains = loadDomainPasswords()
  const statuses: DomainStatus[] = []

  const checks = Object.entries(domains).map(async ([domain, config]) => {
    const [portListening, httpAccessible, httpsAccessible, systemdService, caddyConfigured, siteDirectoryExists] =
      await Promise.all([
        checkPortListening(config.port),
        checkHttpAccessible(domain),
        checkHttpsAccessible(domain),
        checkSystemdService(domain),
        checkCaddyConfigured(domain),
        checkSiteDirectory(domain),
      ])

    return {
      domain,
      portListening,
      httpAccessible,
      httpsAccessible,
      systemdServiceExists: systemdService.exists,
      systemdServiceRunning: systemdService.running,
      caddyConfigured,
      siteDirectoryExists,
      lastChecked: Date.now(),
    }
  })

  const results = await Promise.all(checks)
  statuses.push(...results)

  const res = NextResponse.json({ ok: true, statuses })
  addCorsHeaders(res, origin)
  return res
}
