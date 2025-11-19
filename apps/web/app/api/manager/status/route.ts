import { exec } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { addCorsHeaders } from "@/lib/cors-utils"
import { getAllDomains } from "@/lib/deployment/domain-registry"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import type { DomainStatus } from "@/types/domain"

const execAsync = promisify(exec)

interface ServerConfig {
  serverIp: string
  serverIpv6: string
  createdAt: number
}

async function loadServerConfig(): Promise<ServerConfig | null> {
  try {
    const configPath = "/var/lib/claude-bridge/server-config.json"
    const data = await readFile(configPath, "utf-8")
    return JSON.parse(data)
  } catch {
    return null
  }
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

/**
 * Check DNS resolution by verifying the domain serves our verification file
 * This works with any CDN/proxy setup (Cloudflare, etc.)
 */
async function checkDnsResolution(
  domain: string,
  serverIp: string,
): Promise<{ pointsToServer: boolean; resolvedIp: string | null; isProxied?: boolean; verificationMethod?: string }> {
  try {
    // First, get the resolved IP for display purposes
    const { stdout } = await execAsync(`host -t A ${domain} 2>/dev/null || echo "NXDOMAIN"`)

    let resolvedIp: string | null = null
    if (!stdout.includes("NXDOMAIN") && !stdout.includes("not found")) {
      const match = stdout.match(/has address\s+(\d+\.\d+\.\d+\.\d+)/)
      if (match) {
        resolvedIp = match[1]
      }
    }

    // Try to fetch the verification file via HTTPS first, then HTTP
    const verificationPath = "/.well-known/bridge-verify.txt"

    for (const protocol of ["https", "http"]) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3000)

        const response = await fetch(`${protocol}://${domain}${verificationPath}`, {
          signal: controller.signal,
          redirect: "follow",
        })

        clearTimeout(timeout)

        if (response.ok) {
          const content = (await response.text()).trim()
          const pointsToServer = content === serverIp
          const isProxied = resolvedIp !== null && resolvedIp !== serverIp

          return {
            pointsToServer,
            resolvedIp,
            isProxied,
            verificationMethod: protocol,
          }
        }
      } catch {}
    }

    // Verification file not found or unreachable
    // Fall back to direct IP comparison
    const directMatch = resolvedIp === serverIp
    return {
      pointsToServer: directMatch,
      resolvedIp,
      isProxied: false,
      verificationMethod: directMatch ? "direct-ip" : "none",
    }
  } catch {
    return { pointsToServer: false, resolvedIp: null, verificationMethod: "error" }
  }
}

async function checkViteConfigPort(
  domain: string,
  expectedPort: number,
): Promise<{ mismatch: boolean; actualPort: number | null; hasSystemdOverride: boolean }> {
  try {
    const sitePath = `/srv/webalive/sites/${domain}`
    const slug = domain.replace(/[^a-zA-Z0-9]/g, "-")

    // Check for systemd override file
    let hasSystemdOverride = false
    try {
      await execAsync(`test -f "/etc/systemd/system/site@${slug}.service.d/port-override.conf"`)
      hasSystemdOverride = true
    } catch {
      hasSystemdOverride = false
    }

    // Try vite.config.ts first
    let configPath: string | null = null
    try {
      await execAsync(`test -f "${sitePath}/user/vite.config.ts"`)
      configPath = `${sitePath}/user/vite.config.ts`
    } catch {
      try {
        await execAsync(`test -f "${sitePath}/user/vite.config.js"`)
        configPath = `${sitePath}/user/vite.config.js`
      } catch {
        return { mismatch: hasSystemdOverride, actualPort: null, hasSystemdOverride }
      }
    }

    const { stdout } = await execAsync(`grep -o 'port: [0-9]*' "${configPath}" | head -1`)
    const match = stdout.match(/port: (\d+)/)

    if (!match) {
      return { mismatch: hasSystemdOverride, actualPort: null, hasSystemdOverride }
    }

    const actualPort = Number.parseInt(match[1], 10)
    const mismatch = actualPort !== expectedPort || hasSystemdOverride

    return { mismatch, actualPort, hasSystemdOverride }
  } catch {
    return { mismatch: false, actualPort: null, hasSystemdOverride: false }
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

  const domains = await getAllDomains()
  const statuses: DomainStatus[] = []
  const serverConfig = await loadServerConfig()
  const serverIp = serverConfig?.serverIp || "138.201.56.93"

  const checks = domains.map(async domainInfo => {
    const domain = domainInfo.hostname
    const port = domainInfo.port

    const [
      portListening,
      httpAccessible,
      httpsAccessible,
      systemdService,
      caddyConfigured,
      siteDirectoryExists,
      dnsCheck,
      vitePortCheck,
    ] = await Promise.all([
      checkPortListening(port),
      checkHttpAccessible(domain),
      checkHttpsAccessible(domain),
      checkSystemdService(domain),
      checkCaddyConfigured(domain),
      checkSiteDirectory(domain),
      checkDnsResolution(domain, serverIp),
      checkViteConfigPort(domain, port),
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
      dnsPointsToServer: dnsCheck.pointsToServer,
      dnsResolvedIp: dnsCheck.resolvedIp,
      dnsIsProxied: dnsCheck.isProxied,
      dnsVerificationMethod: dnsCheck.verificationMethod,
      vitePortMismatch: vitePortCheck.mismatch,
      viteExpectedPort: port,
      viteActualPort: vitePortCheck.actualPort,
      hasSystemdPortOverride: vitePortCheck.hasSystemdOverride,
      createdAt: domainInfo.createdAt || null,
      lastChecked: Date.now(),
    }
  })

  const results = await Promise.all(checks)
  statuses.push(...results)

  const res = NextResponse.json({ ok: true, statuses })
  addCorsHeaders(res, origin)
  return res
}
