import * as Sentry from "@sentry/nextjs"
import { env } from "@webalive/env/server"
import { Sandbox } from "e2b"
import { z } from "zod"
import { structuredErrorResponse } from "@/lib/api/responses"
import { ErrorCodes } from "@/lib/error-codes"
import { createAppClient } from "@/lib/supabase/app"

const RuntimeResponseSchema = z.object({
  domain_id: z.string(),
  hostname: z.string(),
  org_id: z.string(),
  is_test_env: z.boolean(),
  execution_mode: z.enum(["systemd", "e2b"]),
  sandbox_id: z.string().nullable(),
  sandbox_status: z.enum(["creating", "running", "dead"]).nullable(),
})

const UpdateBodySchema = z.object({
  workspace: z.string().min(1),
  executionMode: z.enum(["systemd", "e2b"]),
  sandboxStatus: z.enum(["creating", "running", "dead"]).nullable().optional(),
  sandboxId: z.string().nullable().optional(),
  killSandbox: z.boolean().optional().default(false),
  resetSandboxFields: z.boolean().optional().default(false),
})

function hasTestAccess(req: Request): boolean {
  const isTestEnv = env.NODE_ENV === "test" || env.STREAM_ENV === "local"
  const testSecret = req.headers.get("x-test-secret")
  const expectedSecret = env.E2E_TEST_SECRET
  const hasValidSecret = expectedSecret && testSecret === expectedSecret
  return isTestEnv || !!hasValidSecret
}

async function getDomainRuntime(workspace: string) {
  const app = await createAppClient("service")
  const { data, error } = await app
    .from("domains")
    .select("domain_id, hostname, org_id, is_test_env, execution_mode, sandbox_id, sandbox_status")
    .eq("hostname", workspace)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw new Error(`Failed to fetch runtime for ${workspace}: ${error.message}`)
  }

  return RuntimeResponseSchema.parse(data)
}

async function killSandboxIfRequested(
  domain: z.infer<typeof RuntimeResponseSchema>,
  shouldKill: boolean,
): Promise<{ killed: boolean }> {
  if (!shouldKill || !domain.sandbox_id) return { killed: false }

  const e2bDomain = process.env.E2B_DOMAIN
  if (!e2bDomain) {
    throw new Error("E2B_DOMAIN environment variable is required when killSandbox=true")
  }

  try {
    const sandbox = await Sandbox.connect(domain.sandbox_id, { domain: e2bDomain, timeoutMs: 10_000 })
    await sandbox.kill()
    return { killed: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[Test E2B Domain] sandbox kill failed for ${domain.hostname}/${domain.sandbox_id}: ${message}`)
    return { killed: false }
  }
}

export async function GET(req: Request) {
  if (!hasTestAccess(req)) {
    return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 404 })
  }

  const workspace = new URL(req.url).searchParams.get("workspace")
  if (!workspace) {
    return structuredErrorResponse(ErrorCodes.VALIDATION_ERROR, {
      status: 400,
      details: { message: "Missing workspace query parameter" },
    })
  }

  try {
    const runtime = await getDomainRuntime(workspace)
    if (!runtime) {
      return structuredErrorResponse(ErrorCodes.WORKSPACE_NOT_FOUND, { status: 404, details: { workspace } })
    }

    if (!runtime.is_test_env) {
      return structuredErrorResponse(ErrorCodes.FORBIDDEN, {
        status: 403,
        details: { message: "Endpoint can only manage test domains" },
      })
    }

    return Response.json({ ok: true, domain: runtime })
  } catch (error) {
    console.error("[Test E2B Domain] GET failed:", error)
    Sentry.captureException(error)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!hasTestAccess(req)) {
    return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 404 })
  }

  let body: z.infer<typeof UpdateBodySchema>
  try {
    body = UpdateBodySchema.parse(await req.json())
  } catch (_err) {
    return structuredErrorResponse(ErrorCodes.VALIDATION_ERROR, {
      status: 400,
      details: { message: "Invalid payload for e2b-domain update" },
    })
  }

  try {
    const current = await getDomainRuntime(body.workspace)
    if (!current) {
      return structuredErrorResponse(ErrorCodes.WORKSPACE_NOT_FOUND, {
        status: 404,
        details: { workspace: body.workspace },
      })
    }

    if (!current.is_test_env) {
      return structuredErrorResponse(ErrorCodes.FORBIDDEN, {
        status: 403,
        details: { message: "Endpoint can only manage test domains" },
      })
    }

    const killResult = await killSandboxIfRequested(current, body.killSandbox)

    const nextSandboxId = body.resetSandboxFields ? null : (body.sandboxId ?? current.sandbox_id)
    const nextSandboxStatus = body.resetSandboxFields ? null : (body.sandboxStatus ?? current.sandbox_status)

    const app = await createAppClient("service")
    const { data, error } = await app
      .from("domains")
      .update({
        execution_mode: body.executionMode,
        sandbox_id: nextSandboxId,
        sandbox_status: nextSandboxStatus,
      })
      .eq("domain_id", current.domain_id)
      .select("domain_id, hostname, org_id, is_test_env, execution_mode, sandbox_id, sandbox_status")
      .single()

    if (error) {
      throw new Error(`Failed to update runtime for ${current.hostname}: ${error.message}`)
    }

    return Response.json({
      ok: true,
      domain: RuntimeResponseSchema.parse(data),
      kill: killResult,
    })
  } catch (error) {
    console.error("[Test E2B Domain] POST failed:", error)
    Sentry.captureException(error)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }
}
