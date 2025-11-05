import { exec } from "node:child_process"
import { promisify } from "node:util"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { addCorsHeaders } from "@/lib/cors-utils"
import { loadDomainPasswords, updateDomainPassword } from "@/types/guards/api"

const execAsync = promisify(exec)

async function detectOrphanedDomains(): Promise<string[]> {
  const orphaned = new Set<string>()

  try {
    const { stdout: services } = await execAsync("systemctl list-units 'site@*.service' --no-legend --no-pager")
    const serviceMatches = services.matchAll(/site@([a-zA-Z0-9-]+)\.service/g)
    for (const match of serviceMatches) {
      const slug = match[1]
      const domain = slug.replace(/-/g, ".")
      orphaned.add(domain)
    }
  } catch {
    // Ignore systemctl errors
  }

  try {
    const caddyfilePath = "/root/webalive/claude-bridge/Caddyfile"
    const { stdout: caddyContent } = await execAsync(`cat ${caddyfilePath}`)
    const caddyMatches = caddyContent.matchAll(/^([a-zA-Z0-9.-]+)\s+\{/gm)
    for (const match of caddyMatches) {
      orphaned.add(match[1])
    }
  } catch {
    // Ignore Caddyfile read errors
  }

  return Array.from(orphaned)
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")
  const jar = await cookies()

  if (!jar.get("manager_session")) {
    const res = NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    addCorsHeaders(res, origin)
    return res
  }

  const domains = loadDomainPasswords()
  const orphanedDomains = await detectOrphanedDomains()

  const sanitizedDomains: Record<string, { tenantId?: string; port?: number; orphaned?: boolean }> = {}

  for (const [domain, config] of Object.entries(domains)) {
    sanitizedDomains[domain] = {
      tenantId: config.tenantId,
      port: config.port,
    }
  }

  for (const domain of orphanedDomains) {
    if (!sanitizedDomains[domain]) {
      sanitizedDomains[domain] = {
        orphaned: true,
      }
    }
  }

  const res = NextResponse.json({ ok: true, domains: sanitizedDomains })
  addCorsHeaders(res, origin)
  return res
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")
  const jar = await cookies()

  if (!jar.get("manager_session")) {
    const res = NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    addCorsHeaders(res, origin)
    return res
  }

  try {
    const body = await req.json()
    const { domain, password } = body

    if (!domain || !password) {
      const res = NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 })
      addCorsHeaders(res, origin)
      return res
    }

    await updateDomainPassword(domain, password)
    const res = NextResponse.json({ ok: true })
    addCorsHeaders(res, origin)
    return res
  } catch (_error) {
    const res = NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
    addCorsHeaders(res, origin)
    return res
  }
}

export async function DELETE(req: NextRequest) {
  const origin = req.headers.get("origin")
  const jar = await cookies()

  if (!jar.get("manager_session")) {
    const res = NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    addCorsHeaders(res, origin)
    return res
  }

  try {
    const body = await req.json()
    const { domain } = body

    if (!domain) {
      const res = NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 })
      addCorsHeaders(res, origin)
      return res
    }

    try {
      const { stdout, stderr } = await execAsync(
        `/root/webalive/claude-bridge/scripts/delete-site-systemd.sh ${domain}`,
      )
      const res = NextResponse.json({ ok: true, output: stdout, error: stderr || null })
      addCorsHeaders(res, origin)
      return res
    } catch (error) {
      const res = NextResponse.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : "Failed to delete site",
        },
        { status: 500 },
      )
      addCorsHeaders(res, origin)
      return res
    }
  } catch (_error) {
    const res = NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
    addCorsHeaders(res, origin)
    return res
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin ?? null)
  return res
}
