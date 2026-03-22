import * as Sentry from "@sentry/nextjs"
import { SUPERADMIN } from "@webalive/shared"
import { regeneratePortMap } from "@webalive/site-controller"
import { NextResponse } from "next/server"
import { validateRequest } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { resolveDomainRuntime } from "@/lib/domain/resolve-domain-runtime"
import { ErrorCodes } from "@/lib/error-codes"
import { getSessionRegistry } from "@/lib/sandbox/session-registry"

/**
 * POST /api/sandbox/ensure
 *
 * Called by the frontend when opening an E2B workspace.
 * Connects to / resumes the sandbox, starts the dev server if needed,
 * detects the actual port, updates the DB, and regenerates the sandbox-map
 * so the preview proxy uses the right port.
 *
 * Returns quickly for non-E2B workspaces (no-op).
 */
export async function POST(req: Request) {
	const requestId = crypto.randomUUID().slice(0, 8)

	const result = await validateRequest(req, requestId)
	if ("error" in result) return result.error
	const { workspace } = result.data

	if (workspace === SUPERADMIN.WORKSPACE_NAME) {
		return NextResponse.json({ ok: true, mode: "systemd" })
	}

	let domain: Awaited<ReturnType<typeof resolveDomainRuntime>>
	try {
		domain = await resolveDomainRuntime(workspace)
	} catch (err) {
		Sentry.captureException(err, { extra: { requestId, workspace } })
		return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500, details: { requestId } })
	}

	if (!domain || domain.execution_mode !== "e2b") {
		return NextResponse.json({ ok: true, mode: "systemd" })
	}

	// Ensure sandbox is connected, dev server running, and port synced to DB
	try {
		await getSessionRegistry().ensureReady(domain)
	} catch (err) {
		Sentry.captureException(err, { extra: { requestId, workspace, sandboxId: domain.sandbox_id } })
		return structuredErrorResponse(ErrorCodes.SANDBOX_NOT_READY, { status: 503, details: { requestId } })
	}

	// Regenerate sandbox-map.json so preview proxy picks up the (possibly new) port
	try {
		await regeneratePortMap()
	} catch (err) {
		Sentry.captureException(err, { extra: { requestId, workspace } })
	}

	return NextResponse.json({ ok: true, mode: "e2b", sandboxId: domain.sandbox_id })
}
