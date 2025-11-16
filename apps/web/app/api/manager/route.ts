import { exec } from "node:child_process"
import { promisify } from "node:util"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { addCorsHeaders } from "@/lib/cors-utils"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { workspaceRepository } from "@/lib/db/repositories"
import type { DomainConfigClient } from "@/types/domain"
import { updateDomainConfig } from "@/types/guards/api"

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

  // Load workspaces from database
  const workspaces = await workspaceRepository.findAll()
  const orphanedDomains = await detectOrphanedDomains()

  const sanitizedDomains: Record<string, DomainConfigClient> = {}

  for (const workspace of workspaces) {
    // Skip preview domains
    if (isPreviewDomain(workspace.domain)) {
      continue
    }

    sanitizedDomains[workspace.domain] = {
      tenantId: workspace.id, // Workspace ID is the tenant ID
      port: workspace.port,
      email: undefined, // Email is per-user now, not per-workspace
      credits: workspace.credits ?? 0,
    }
  }

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

    // Find workspace in database
    const workspace = await workspaceRepository.findByDomain(domain)

    if (!workspace) {
      return corsResponse(
        origin,
        {
          ok: false,
          error: ErrorCodes.INVALID_REQUEST,
          message: "Workspace not found",
          requestId,
        },
        404,
      )
    }

    // Update credits in database if provided
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
      await workspaceRepository.updateCredits(workspace.id, credits)
    }

    // Update password/email in old JSON file if provided (legacy support)
    // TODO: Move password to user table, remove email from workspace
    if (password || email !== undefined) {
      const updates: { password?: string; email?: string } = {}
      if (password) updates.password = password
      if (email !== undefined) updates.email = email
      await updateDomainConfig(domain, updates)
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
