import { exec } from "node:child_process"
import { promisify } from "node:util"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { updateDomainOwnerPassword } from "@/lib/auth/supabase-passwords"
import { addCorsHeaders } from "@/lib/cors-utils"
import { getAllDomains } from "@/lib/deployment/domain-registry"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { updateOrgCredits } from "@/lib/tokens"
import type { DomainConfigClient } from "@/types/domain"

const execAsync = promisify(exec)

function corsResponse(origin: string | null, data: unknown, status = 200): NextResponse {
  const res = NextResponse.json(data, { status })
  addCorsHeaders(res, origin)
  return res
}

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

function isPreviewDomain(domain: string): boolean {
  return domain.includes(".preview.terminal.goalive.nl")
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")
  const jar = await cookies()
  const requestId = crypto.randomUUID()

  if (!jar.get("manager_session")) {
    return corsResponse(
      origin,
      {
        ok: false,
        error: ErrorCodes.UNAUTHORIZED,
        message: getErrorMessage(ErrorCodes.UNAUTHORIZED),
        requestId,
      },
      401,
    )
  }

  // Load all domains from Supabase (includes port, credits, email)
  const allDomains = await getAllDomains()
  const orphanedDomains = await detectOrphanedDomains()

  const sanitizedDomains: Record<string, DomainConfigClient> = {}

  // Add all domains from Supabase with full info
  for (const domainInfo of allDomains) {
    // Skip preview domains
    if (isPreviewDomain(domainInfo.hostname)) {
      continue
    }

    sanitizedDomains[domainInfo.hostname] = {
      tenantId: domainInfo.hostname,
      port: domainInfo.port,
      email: domainInfo.ownerEmail,
      orgId: domainInfo.orgId,
      credits: domainInfo.credits,
    }
  }

  // Add orphaned domains (not in Supabase)
  for (const domain of orphanedDomains) {
    // Skip preview domains
    if (isPreviewDomain(domain)) {
      continue
    }

    if (!sanitizedDomains[domain]) {
      sanitizedDomains[domain] = {
        orphaned: true,
        credits: 0,
      }
    }
  }

  return corsResponse(origin, { ok: true, domains: sanitizedDomains })
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")
  const jar = await cookies()
  const requestId = crypto.randomUUID()

  if (!jar.get("manager_session")) {
    return corsResponse(
      origin,
      {
        ok: false,
        error: ErrorCodes.UNAUTHORIZED,
        message: getErrorMessage(ErrorCodes.UNAUTHORIZED),
        requestId,
      },
      401,
    )
  }

  try {
    const body = await req.json()
    const { domain: rawDomain, password, email, credits } = body
    const domain = rawDomain?.toLowerCase() // Always lowercase domain

    if (!domain) {
      return corsResponse(
        origin,
        {
          ok: false,
          error: ErrorCodes.INVALID_REQUEST,
          message: getErrorMessage(ErrorCodes.INVALID_REQUEST),
          requestId,
        },
        400,
      )
    }

    // Update credits in Supabase if provided
    if (credits !== undefined) {
      if (typeof credits !== "number" || credits < 0) {
        return corsResponse(
          origin,
          {
            ok: false,
            error: ErrorCodes.INVALID_REQUEST,
            message: "Credits must be a non-negative number",
            requestId,
          },
          400,
        )
      }

      const success = await updateOrgCredits(domain, credits)
      if (!success) {
        return corsResponse(
          origin,
          {
            ok: false,
            error: ErrorCodes.INVALID_REQUEST,
            message: "Failed to update credits (domain or org not found)",
            requestId,
          },
          404,
        )
      }
    }

    // Update password/email in Supabase
    if (password) {
      const passwordSuccess = await updateDomainOwnerPassword(domain, password)
      if (!passwordSuccess) {
        return corsResponse(
          origin,
          {
            ok: false,
            error: ErrorCodes.INTERNAL_ERROR,
            message: "Failed to update password",
            requestId,
          },
          500,
        )
      }
    }

    if (email !== undefined) {
      // Note: This updates the email for the domain owner
      // If you need to update a specific user's email, you'll need to pass the old email
      console.warn("[Manager] Email update via domain not yet implemented - need old email address")
    }

    return corsResponse(origin, { ok: true, requestId })
  } catch (_error) {
    return corsResponse(
      origin,
      {
        ok: false,
        error: ErrorCodes.INVALID_JSON,
        message: getErrorMessage(ErrorCodes.INVALID_JSON),
        requestId,
      },
      400,
    )
  }
}

export async function DELETE(req: NextRequest) {
  const origin = req.headers.get("origin")
  const jar = await cookies()
  const requestId = crypto.randomUUID()

  if (!jar.get("manager_session")) {
    return corsResponse(
      origin,
      {
        ok: false,
        error: ErrorCodes.UNAUTHORIZED,
        message: getErrorMessage(ErrorCodes.UNAUTHORIZED),
        requestId,
      },
      401,
    )
  }

  try {
    const body = await req.json()
    const { domain: rawDomain } = body
    const domain = rawDomain?.toLowerCase() // Always lowercase domain

    if (!domain) {
      return corsResponse(
        origin,
        {
          ok: false,
          error: ErrorCodes.INVALID_REQUEST,
          message: getErrorMessage(ErrorCodes.INVALID_REQUEST, { field: "domain" }),
          requestId,
        },
        400,
      )
    }

    try {
      const { stdout, stderr } = await execAsync(
        `/root/webalive/claude-bridge/scripts/delete-site-systemd.sh ${domain}`,
      )
      return corsResponse(origin, { ok: true, output: stdout, error: stderr || null, requestId })
    } catch (error) {
      return corsResponse(
        origin,
        {
          ok: false,
          error: ErrorCodes.INTERNAL_ERROR,
          message: getErrorMessage(ErrorCodes.INTERNAL_ERROR),
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
          requestId,
        },
        500,
      )
    }
  } catch (_error) {
    return corsResponse(
      origin,
      {
        ok: false,
        error: ErrorCodes.INVALID_JSON,
        message: getErrorMessage(ErrorCodes.INVALID_JSON),
        requestId,
      },
      400,
    )
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
  return corsResponse(origin ?? null, null)
}
