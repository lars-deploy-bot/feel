/**
 * Sandbox Session Registry — web app singleton
 *
 * Creates a SandboxSessionRegistry backed by Supabase for persistence.
 * File API routes use this to acquire sessions for E2B domains.
 */

import { createSandboxSessionRegistry, type SandboxSessionRegistry } from "@webalive/sandbox"
import { getE2bDomain } from "@/lib/env"
import { createAppClient } from "@/lib/supabase/app"

let registry: SandboxSessionRegistry | null = null

export function getSessionRegistry(): SandboxSessionRegistry {
  if (registry) {
    return registry
  }

  registry = createSandboxSessionRegistry({
    domain: getE2bDomain(),
    persistence: {
      async updateSandbox(domainId, sandboxId, status) {
        const app = await createAppClient("service")
        const { error } = await app
          .from("domains")
          .update({
            sandbox_id: sandboxId.length > 0 ? sandboxId : null,
            sandbox_status: status,
          })
          .eq("domain_id", domainId)

        if (error) {
          throw new Error(`Failed to persist sandbox state for ${domainId}: ${error.message}`)
        }
      },
      async updatePort(domainId, port) {
        const app = await createAppClient("service")
        const { error } = await app.from("domains").update({ port }).eq("domain_id", domainId)

        if (error) {
          throw new Error(`Failed to update port for ${domainId}: ${error.message}`)
        }
      },
    },
  })

  return registry
}
