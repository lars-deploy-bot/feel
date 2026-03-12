import { DOMAIN_RUNTIME_SELECT, resolveDomainRuntimeQuery, type DomainRuntimeRecord } from "@webalive/sandbox"
import { createAppClient } from "@/lib/supabase/app"

export { DOMAIN_RUNTIME_SELECT, resolveDomainRuntimeQuery }
export type DomainRuntime = DomainRuntimeRecord

/** A resolved domain that is guaranteed non-null. Used by E2B handler functions. */
export type ResolvedDomain = NonNullable<DomainRuntime>

export async function resolveDomainRuntime(hostname: string): Promise<DomainRuntime | null> {
  const app = await createAppClient("service")
  return resolveDomainRuntimeQuery(
    hostname,
    app.from("domains").select(DOMAIN_RUNTIME_SELECT).eq("hostname", hostname).single(),
  )
}
