import { connectRunningSandbox, DEFAULT_SANDBOX_CONNECT_TIMEOUT_MS, type SandboxDomain } from "@webalive/sandbox"
import type { Sandbox } from "e2b"
import type { DomainRuntime } from "@/lib/domain/resolve-domain-runtime"
import { getE2bDomain } from "@/lib/env"
import { createAppClient } from "@/lib/supabase/app"

export { RuntimeNotReadyError as SandboxNotReadyError, SANDBOX_WORKSPACE_ROOT } from "@webalive/sandbox"

async function markSandboxDeadIfCurrent(domain: SandboxDomain): Promise<void> {
  if (!domain.sandbox_id) return

  const app = await createAppClient("service")
  const { error } = await app
    .from("domains")
    .update({ sandbox_status: "dead" })
    .eq("domain_id", domain.domain_id)
    .eq("sandbox_id", domain.sandbox_id)
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
  return connectRunningSandbox(
    {
      ...runtime,
      is_test_env: runtime.is_test_env ?? undefined,
    },
    {
      e2bDomain: getE2bDomain(),
      connectTimeoutMs: DEFAULT_SANDBOX_CONNECT_TIMEOUT_MS,
      markDeadIfCurrent: markSandboxDeadIfCurrent,
    },
  )
}
