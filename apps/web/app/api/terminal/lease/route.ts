import * as Sentry from "@sentry/nextjs"
import { env } from "@webalive/env/server"
import { DOMAINS, SUPERADMIN } from "@webalive/shared"
import { NextResponse } from "next/server"
import { z } from "zod"
import { validateRequest } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { resolveDomainRuntime } from "@/lib/domain/resolve-domain-runtime"
import { ErrorCodes } from "@/lib/error-codes"

const LeaseResponseSchema = z.object({
  lease: z.string(),
  workspace: z.string(),
  expiresAt: z.number(),
})

const SHELL_SERVER_URL = "http://localhost:3888"
const E2B_TERMINAL_URL = "http://localhost:5075"

export async function POST(req: Request) {
  const requestId = crypto.randomUUID().slice(0, 8)

  const result = await validateRequest(req, requestId)
  if ("error" in result) return result.error
  const { workspace } = result.data

  // Map superadmin workspace to shell-server-go's "root" workspace
  const shellWorkspace = workspace === SUPERADMIN.WORKSPACE_NAME ? "root" : workspace

  const shellPassword = env.SHELL_PASSWORD
  if (!shellPassword) {
    console.error(`[Terminal ${requestId}] SHELL_PASSWORD not configured`)
    Sentry.captureMessage(`[Terminal ${requestId}] SHELL_PASSWORD not configured`, "error")
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500, details: { requestId } })
  }

  const shellHost = DOMAINS.SHELL_HOST
  if (!shellHost) {
    console.error(`[Terminal ${requestId}] Shell host not configured in server-config.json`)
    Sentry.captureMessage(`[Terminal ${requestId}] Shell host not configured in server-config.json`, "error")
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500, details: { requestId } })
  }

  // Superadmin uses systemd/root access, never E2B — skip the DB lookup
  let domain: Awaited<ReturnType<typeof resolveDomainRuntime>> = null
  try {
    domain = workspace === SUPERADMIN.WORKSPACE_NAME ? null : await resolveDomainRuntime(shellWorkspace)
  } catch (err) {
    console.error(`[Terminal ${requestId}] Failed to resolve domain runtime for ${shellWorkspace}:`, err)
    Sentry.captureException(err, { extra: { requestId, workspace: shellWorkspace } })
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500, details: { requestId } })
  }
  if (domain?.execution_mode === "e2b") {
    // Fail fast if sandbox isn't running — worker must create first
    if (!domain.sandbox_id || !domain.hostname || domain.sandbox_status !== "running") {
      return structuredErrorResponse(ErrorCodes.SANDBOX_NOT_READY, { status: 503, details: { requestId } })
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const res = await fetch(`${E2B_TERMINAL_URL}/internal/lease`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": shellPassword,
        },
        body: JSON.stringify({
          workspace: shellWorkspace,
          sandboxDomain: {
            domain_id: domain.domain_id,
            hostname: domain.hostname,
            sandbox_id: domain.sandbox_id,
            sandbox_status: domain.sandbox_status,
          },
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!res.ok) {
        const text = await res.text()
        console.error(`[Terminal ${requestId}] E2B bridge returned ${res.status}: ${text}`)
        Sentry.captureMessage(`[Terminal ${requestId}] E2B bridge returned ${res.status}: ${text}`, "error")
        return structuredErrorResponse(ErrorCodes.SHELL_SERVER_UNAVAILABLE, { status: 502, details: { requestId } })
      }

      const parsed = LeaseResponseSchema.safeParse(await res.json())
      if (!parsed.success) {
        console.error(`[Terminal ${requestId}] Unexpected E2B bridge response shape`)
        Sentry.captureMessage(`[Terminal ${requestId}] Unexpected E2B bridge response shape`, "error")
        return structuredErrorResponse(ErrorCodes.SHELL_SERVER_UNAVAILABLE, { status: 502, details: { requestId } })
      }
      const data = parsed.data

      // E2B terminal uses /e2b/ws path on the same shell host (caddy-shell routes it)
      return NextResponse.json({
        ok: true,
        lease: data.lease,
        wsUrl: `wss://${shellHost}/e2b/ws?lease=${encodeURIComponent(data.lease)}`,
        workspace: data.workspace,
        expiresAt: data.expiresAt,
      })
    } catch (err) {
      console.error(`[Terminal ${requestId}] Failed to reach E2B bridge:`, err)
      Sentry.captureException(err)
      return structuredErrorResponse(ErrorCodes.SHELL_SERVER_UNAVAILABLE, { status: 502, details: { requestId } })
    }
  }

  // Systemd path: existing shell-server-go flow
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(`${SHELL_SERVER_URL}/internal/lease`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": shellPassword,
      },
      body: JSON.stringify({ workspace: shellWorkspace }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      const text = await res.text()
      console.error(`[Terminal ${requestId}] Shell server returned ${res.status}: ${text}`)
      Sentry.captureMessage(`[Terminal ${requestId}] Shell server returned ${res.status}: ${text}`, "error")
      return structuredErrorResponse(ErrorCodes.SHELL_SERVER_UNAVAILABLE, { status: 502, details: { requestId } })
    }

    const parsed = LeaseResponseSchema.safeParse(await res.json())
    if (!parsed.success) {
      console.error(`[Terminal ${requestId}] Unexpected shell server response shape`)
      Sentry.captureMessage(`[Terminal ${requestId}] Unexpected shell server response shape`, "error")
      return structuredErrorResponse(ErrorCodes.SHELL_SERVER_UNAVAILABLE, { status: 502, details: { requestId } })
    }
    const data = parsed.data

    return NextResponse.json({
      ok: true,
      lease: data.lease,
      wsUrl: `wss://${shellHost}/ws?lease=${encodeURIComponent(data.lease)}`,
      workspace: data.workspace,
      expiresAt: data.expiresAt,
    })
  } catch (err) {
    console.error(`[Terminal ${requestId}] Failed to reach shell server:`, err)
    Sentry.captureException(err)
    return structuredErrorResponse(ErrorCodes.SHELL_SERVER_UNAVAILABLE, { status: 502, details: { requestId } })
  }
}
