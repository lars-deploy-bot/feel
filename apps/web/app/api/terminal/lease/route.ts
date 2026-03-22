import * as Sentry from "@sentry/nextjs"
import { env } from "@webalive/env/server"
import { DOMAINS, SHELL, SUPERADMIN } from "@webalive/shared"
import { NextResponse } from "next/server"
import { validateRequest } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { resolveDomainRuntime } from "@/lib/domain/resolve-domain-runtime"
import { ErrorCodes } from "@/lib/error-codes"
import { requestInternalLease } from "@/lib/terminal/internal-lease"

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
  if (!SHELL.UPSTREAM) {
    console.error(`[Terminal ${requestId}] Shell upstream not configured in server-config.json`)
    Sentry.captureMessage(`[Terminal ${requestId}] Shell upstream not configured in server-config.json`, "error")
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
    if (!SHELL.E2B_UPSTREAM) {
      console.error(`[Terminal ${requestId}] E2B shell upstream not configured in server-config.json`)
      Sentry.captureMessage(`[Terminal ${requestId}] E2B shell upstream not configured in server-config.json`, "error")
      return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500, details: { requestId } })
    }

    // Fail fast if sandbox isn't running — worker must create first
    if (!domain.sandbox_id || !domain.hostname || domain.sandbox_status !== "running") {
      return structuredErrorResponse(ErrorCodes.SANDBOX_NOT_READY, { status: 503, details: { requestId } })
    }

    try {
      const data = await requestInternalLease({
        upstream: SHELL.E2B_UPSTREAM,
        requestId,
        serviceName: "E2B terminal bridge",
        secret: shellPassword,
        body: {
          workspace: shellWorkspace,
          sandboxDomain: {
            domain_id: domain.domain_id,
            hostname: domain.hostname,
            port: domain.port,
            sandbox_id: domain.sandbox_id,
            sandbox_status: domain.sandbox_status,
          },
        },
      })

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
    const data = await requestInternalLease({
      upstream: SHELL.UPSTREAM,
      requestId,
      serviceName: "Shell server",
      secret: shellPassword,
      body: { workspace: shellWorkspace },
    })

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
