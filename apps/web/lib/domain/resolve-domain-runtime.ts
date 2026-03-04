import type { ExecutionMode, SandboxStatus } from "@webalive/database"
import { createAppClient } from "@/lib/supabase/app"

export interface DomainRuntime {
  domain_id: string
  hostname: string
  execution_mode: ExecutionMode
  sandbox_id: string | null
  sandbox_status: SandboxStatus | null
}

/** A resolved domain that is guaranteed non-null. Used by E2B handler functions. */
export type ResolvedDomain = NonNullable<DomainRuntime>

/**
 * Resolve execution runtime for a domain.
 * Single query, single decision point: execution_mode.
 *
 * @returns DomainRuntime or null if domain not found
 */
export async function resolveDomainRuntime(hostname: string): Promise<DomainRuntime | null> {
  const app = await createAppClient("service")
  const { data, error } = await app
    .from("domains")
    .select("domain_id, hostname, execution_mode, sandbox_id, sandbox_status")
    .eq("hostname", hostname)
    .single()
  if (error) {
    // PGRST116 = "no rows returned" from .single() — that's a legitimate "not found"
    if (error.code === "PGRST116") return null
    throw new Error(`Failed to resolve domain runtime for ${hostname}: ${error.message}`)
  }
  return data
}
