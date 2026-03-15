import * as Sentry from "@sentry/nextjs"
import { env } from "@webalive/env/server"
import { DOMAINS, SHELL, SUPERADMIN } from "@webalive/shared"
import { NextResponse } from "next/server"
import { validateRequest } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { resolveDomainRuntime } from "@/lib/domain/resolve-domain-runtime"
import { ErrorCodes } from "@/lib/error-codes"
import { requestInternalWatchLease } from "@/lib/terminal/internal-lease"

export async function POST(req: Request) {
  const requestId = crypto.randomUUID().slice(0, 8)

  const result = await validateRequest(req, requestId)
  if ("error" in result) return result.error
  const { workspace, body } = result.data

  const shellWorkspace = workspace === SUPERADMIN.WORKSPACE_NAME ? "root" : workspace
  const worktree = typeof body.worktree === "string" ? body.worktree : undefined

  // Superadmin uses systemd/root access, never E2B — skip the DB lookup
  let domain: Awaited<ReturnType<typeof resolveDomainRuntime>> = null
  try {
    domain = workspace === SUPERADMIN.WORKSPACE_NAME ? null : await resolveDomainRuntime(shellWorkspace)
  } catch (err) {
    console.error(`[Watch ${requestId}] Failed to resolve domain runtime for ${shellWorkspace}:`, err)
    Sentry.captureException(err, { extra: { requestId, workspace: shellWorkspace } })
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500, details: { requestId } })
  }
  // E2B domains: file watching is not supported
  if (domain?.execution_mode === "e2b") {
    return structuredErrorResponse(ErrorCodes.WATCH_UNSUPPORTED, { status: 501, details: { requestId } })
  }

  const shellPassword = env.SHELL_PASSWORD
  if (!shellPassword) {
    console.error(`[Watch ${requestId}] SHELL_PASSWORD not configured`)
    Sentry.captureMessage(`[Watch ${requestId}] SHELL_PASSWORD not configured`, "error")
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500, details: { requestId } })
  }

  const shellHost = DOMAINS.SHELL_HOST
  if (!shellHost) {
    console.error(`[Watch ${requestId}] Shell host not configured in server-config.json`)
    Sentry.captureMessage(`[Watch ${requestId}] Shell host not configured in server-config.json`, "error")
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500, details: { requestId } })
  }
  if (!SHELL.UPSTREAM) {
    console.error(`[Watch ${requestId}] Shell upstream not configured in server-config.json`)
    Sentry.captureMessage(`[Watch ${requestId}] Shell upstream not configured in server-config.json`, "error")
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500, details: { requestId } })
  }

  try {
    const data = await requestInternalWatchLease({
      upstream: SHELL.UPSTREAM,
      requestId,
      serviceName: "Shell server watch lease",
      secret: shellPassword,
      body: { workspace: shellWorkspace, worktree },
    })

    return NextResponse.json({
      ok: true,
      lease: data.lease,
      wsUrl: `wss://${shellHost}/ws/watch?lease=${encodeURIComponent(data.lease)}`,
      workspace: data.workspace,
      expiresAt: data.expiresAt,
    })
  } catch (err) {
    console.error(`[Watch ${requestId}] Failed to reach shell server:`, err)
    Sentry.captureException(err)
    return structuredErrorResponse(ErrorCodes.SHELL_SERVER_UNAVAILABLE, { status: 502, details: { requestId } })
  }
}
