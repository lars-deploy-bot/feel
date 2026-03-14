import { getSandboxConnectErrorMessage, isSandboxDefinitelyGone, SANDBOX_WORKSPACE_ROOT } from "@webalive/sandbox"
import { Sandbox } from "e2b"
import type { DomainRuntime } from "@/lib/domain/resolve-domain-runtime"
import { createAppClient } from "@/lib/supabase/app"

export { SANDBOX_WORKSPACE_ROOT }

async function markSandboxDeadIfCurrent(runtime: DomainRuntime): Promise<void> {
  if (!runtime.sandbox_id) return

  const app = await createAppClient("service")
  const { error } = await app
    .from("domains")
    .update({ sandbox_status: "dead" })
    .eq("domain_id", runtime.domain_id)
    .eq("sandbox_id", runtime.sandbox_id)
    .eq("sandbox_status", "running")

  if (error) {
    throw new Error(`Failed to mark sandbox dead: ${error.message}`)
  }
}

/**
 * Connect to an existing E2B sandbox. Does NOT create sandboxes.
 * Worker process is the sole owner of sandbox lifecycle.
 *
 * If the sandbox is definitely gone (404/not-found), marks it dead in the DB
 * so the next Claude message triggers SandboxManager to create a fresh one.
 *
 * @throws SandboxNotReadyError if sandbox doesn't exist or isn't running
 */
export async function connectSandbox(runtime: DomainRuntime): Promise<Sandbox> {
  if (!runtime.sandbox_id || runtime.sandbox_status !== "running") {
    throw new SandboxNotReadyError(runtime.hostname, runtime.sandbox_status)
  }

  const e2bDomain = process.env.E2B_DOMAIN
  if (!e2bDomain) {
    throw new Error("E2B_DOMAIN environment variable is required")
  }

  try {
    return await Sandbox.connect(runtime.sandbox_id, {
      domain: e2bDomain,
      timeoutMs: 10_000,
    })
  } catch (err) {
    // Connect can fail for transient infra/network issues too.
    // Only mark dead when we're confident the sandbox is actually gone.
    console.error(
      `[connect-sandbox] Connect failed for ${runtime.hostname} (${runtime.sandbox_id}): ${getSandboxConnectErrorMessage(err)}`,
    )

    if (isSandboxDefinitelyGone(err)) {
      try {
        await markSandboxDeadIfCurrent(runtime)
      } catch (dbErr) {
        console.error(`[connect-sandbox] Failed to mark sandbox dead for ${runtime.hostname}:`, dbErr)
      }
      throw new SandboxNotReadyError(runtime.hostname, "dead")
    }

    throw new SandboxNotReadyError(runtime.hostname, runtime.sandbox_status)
  }
}

export class SandboxNotReadyError extends Error {
  public readonly code = "SANDBOX_NOT_READY" as const
  constructor(hostname: string, status: string | null) {
    super(`Sandbox for ${hostname} is not ready (status: ${status ?? "none"}). Send a message first to initialize.`)
  }
}
