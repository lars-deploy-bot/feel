import { SANDBOX_WORKSPACE_ROOT } from "@webalive/sandbox"
import { Sandbox } from "e2b"
import type { DomainRuntime } from "@/lib/domain/resolve-domain-runtime"

export { SANDBOX_WORKSPACE_ROOT }

/**
 * Connect to an existing E2B sandbox. Does NOT create sandboxes.
 * Worker process is the sole owner of sandbox lifecycle.
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

  return Sandbox.connect(runtime.sandbox_id, {
    domain: e2bDomain,
    timeoutMs: 10_000,
  })
}

export class SandboxNotReadyError extends Error {
  public readonly code = "SANDBOX_NOT_READY" as const
  constructor(hostname: string, status: string | null) {
    super(`Sandbox for ${hostname} is not ready (status: ${status ?? "none"}). Send a message first to initialize.`)
  }
}
