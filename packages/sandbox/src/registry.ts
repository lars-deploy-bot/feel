/**
 * Sandbox Session Registry
 *
 * Factory + in-process cache for SandboxSessions.
 * Wraps SandboxManager internally — callers never see it.
 *
 * `acquire()` handles get-or-create, dedup, reconnect, workspace sync,
 * and returns a domain-bound session ready for use.
 */

import type { E2bTemplate } from "./constants.js"
import type { SandboxDomain, SandboxPersistence } from "./manager.js"
import { ensureDevServer, SandboxManager } from "./manager.js"
import type { SandboxSession } from "./session.js"
import { createSandboxSession } from "./session.js"

export interface SandboxSessionRegistryConfig {
  /** Persists sandbox_id/sandbox_status to the database. */
  persistence: SandboxPersistence
  /** E2B domain, e.g. "e2b.sonno.tech". Required. */
  domain: string
  /** E2B template ID. Defaults to E2B_DEFAULT_TEMPLATE. */
  template?: E2bTemplate
  /** Sandbox timeout in ms. Defaults to 30 days. */
  timeoutMs?: number
}

export interface SandboxSessionRegistry {
  /**
   * Get an existing session or create/reconnect one.
   * Deduplicates concurrent calls for the same domain_id.
   *
   * @param domain - Domain record with sandbox state from the DB.
   * @param hostWorkspacePath - Host-side path to seed the sandbox from on first create.
   */
  acquire(domain: SandboxDomain, hostWorkspacePath?: string): Promise<SandboxSession>

  /**
   * Ensure sandbox is connected, dev server is running, and port is synced.
   * Unlike acquire(), this always checks the dev server state (even for cached sessions).
   */
  ensureReady(domain: SandboxDomain, hostWorkspacePath?: string): Promise<SandboxSession>

  /**
   * Evict the cached session WITHOUT killing the sandbox.
   * Next acquire() will reconnect.
   */
  evict(domainId: string): void
}

export function createSandboxSessionRegistry(config: SandboxSessionRegistryConfig): SandboxSessionRegistry {
  const manager = new SandboxManager({
    persistence: config.persistence,
    domain: config.domain,
    template: config.template,
    timeoutMs: config.timeoutMs,
  })

  const sessions = new Map<string, SandboxSession>()

  return {
    async acquire(domain: SandboxDomain, hostWorkspacePath?: string): Promise<SandboxSession> {
      const cached = sessions.get(domain.domain_id)
      if (cached) {
        return cached
      }

      const sandbox = await manager.getOrCreate(domain, hostWorkspacePath)
      const session = createSandboxSession({ domain_id: domain.domain_id, hostname: domain.hostname }, sandbox, manager)

      sessions.set(domain.domain_id, session)
      return session
    },

    async ensureReady(domain: SandboxDomain, hostWorkspacePath?: string): Promise<SandboxSession> {
      // Track whether we're creating fresh or reusing cached.
      // Fresh sessions already have dev server ensured by the manager — don't double-start.
      const wasCached = sessions.has(domain.domain_id)
      const session = await this.acquire(domain, hostWorkspacePath)

      if (!wasCached) return session

      // For cached sessions, always re-check dev server state (it may have died).
      const actualPort = await ensureDevServer(session.raw, domain.port)
      if (actualPort && actualPort !== domain.port && config.persistence.updatePort) {
        console.error(
          `[sandbox-registry] Port drift for ${domain.hostname}: expected ${domain.port}, got ${actualPort}. Syncing DB.`,
        )
        await config.persistence.updatePort(domain.domain_id, actualPort)
      }

      return session
    },

    evict(domainId: string): void {
      sessions.delete(domainId)
      manager.evict(domainId)
    },
  }
}
