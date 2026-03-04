/**
 * In-memory lease store for E2B terminal bridge.
 * Leases are single-use tokens with a 90-second TTL.
 */

interface LeaseEntry {
  workspace: string
  sandboxId: string
  hostname: string
  createdAt: number
}

const LEASE_TTL_MS = 90_000

const leases = new Map<string, LeaseEntry>()

/** Create a new lease. Returns the lease token. */
export function createLease(workspace: string, sandboxId: string, hostname: string): string {
  const token = crypto.randomUUID()
  leases.set(token, {
    workspace,
    sandboxId,
    hostname,
    createdAt: Date.now(),
  })
  return token
}

/**
 * Consume a lease (single-use). Returns the entry and removes it.
 * Returns null if expired or not found.
 */
export function consumeLease(token: string): LeaseEntry | null {
  const entry = leases.get(token)
  if (!entry) return null

  // Always remove (single-use)
  leases.delete(token)

  // Check TTL
  if (Date.now() - entry.createdAt > LEASE_TTL_MS) {
    return null
  }

  return entry
}

/** Clean up expired leases (call periodically) */
export function cleanExpiredLeases(): void {
  const now = Date.now()
  for (const [token, entry] of leases) {
    if (now - entry.createdAt > LEASE_TTL_MS) {
      leases.delete(token)
    }
  }
}
