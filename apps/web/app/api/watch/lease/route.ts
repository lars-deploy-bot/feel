import * as Sentry from "@sentry/nextjs"
import { env } from "@webalive/env/server"
import { DOMAINS, SUPERADMIN } from "@webalive/shared"
import { NextResponse } from "next/server"
import { z } from "zod"
import { validateRequest } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { ErrorCodes } from "@/lib/error-codes"

const LeaseResponseSchema = z.object({
  lease: z.string(),
  workspace: z.string(),
  expiresAt: z.number(),
})

const SHELL_SERVER_URL = "http://localhost:3888"

export async function POST(req: Request) {
  const requestId = crypto.randomUUID().slice(0, 8)

  const result = await validateRequest(req, requestId)
  if ("error" in result) return result.error
  const { workspace, body } = result.data

  const shellWorkspace = workspace === SUPERADMIN.WORKSPACE_NAME ? "root" : workspace
  const worktree = typeof body.worktree === "string" ? body.worktree : undefined

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

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(`${SHELL_SERVER_URL}/internal/watch-lease`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": shellPassword,
      },
      body: JSON.stringify({ workspace: shellWorkspace, worktree }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[Watch ${requestId}] Shell server returned ${res.status}: ${text}`)
      Sentry.captureMessage(`[Watch ${requestId}] Shell server returned ${res.status}: ${text}`, "error")
      return structuredErrorResponse(ErrorCodes.SHELL_SERVER_UNAVAILABLE, { status: 502, details: { requestId } })
    }

    const parsed = LeaseResponseSchema.safeParse(await res.json())
    if (!parsed.success) {
      console.error(`[Watch ${requestId}] Unexpected shell server response shape`)
      Sentry.captureMessage(`[Watch ${requestId}] Unexpected shell server response shape`, "error")
      return structuredErrorResponse(ErrorCodes.SHELL_SERVER_UNAVAILABLE, { status: 502, details: { requestId } })
    }
    const data = parsed.data

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
  } finally {
    clearTimeout(timeout)
  }
}
