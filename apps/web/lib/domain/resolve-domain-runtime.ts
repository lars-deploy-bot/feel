import type { ExecutionMode, SandboxStatus } from "@webalive/database"
import { createAppClient } from "@/lib/supabase/app"

export interface DomainRuntime {
  domain_id: string
  hostname: string
  port: number
  is_test_env: boolean | null
  test_run_id: string | null
  execution_mode: ExecutionMode
  sandbox_id: string | null
  sandbox_status: SandboxStatus | null
}

/**
 * Extended domain record that includes org_id for credit lookups.
 * Fetched in a single query to avoid triple app.domains lookups per request.
 */
export interface FullDomainRecord extends DomainRuntime {
  org_id: string | null
}

/** A resolved domain that is guaranteed non-null. Used by E2B handler functions. */
export type ResolvedDomain = NonNullable<DomainRuntime>

interface DomainRuntimeQueryError {
  code?: string
  message: string
}

interface DomainRuntimeQueryResult {
  data: DomainRuntime | null
  error?: DomainRuntimeQueryError | null
}

interface FullDomainQueryResult {
  data: FullDomainRecord | null
  error?: DomainRuntimeQueryError | null
}

export const DOMAIN_RUNTIME_SELECT =
  "domain_id, hostname, port, is_test_env, test_run_id, execution_mode, sandbox_id, sandbox_status"

export const FULL_DOMAIN_SELECT =
  "domain_id, hostname, port, is_test_env, test_run_id, execution_mode, sandbox_id, sandbox_status, org_id"

/**
 * Resolve execution runtime for a domain.
 * Single query, single decision point: execution_mode.
 *
 * @returns DomainRuntime or null if domain not found
 */
export async function resolveDomainRuntimeQuery(
  hostname: string,
  query: PromiseLike<DomainRuntimeQueryResult>,
): Promise<DomainRuntime | null> {
  const { data, error } = await query
  if (error) {
    // PGRST116 = "no rows returned" from .single() — that's a legitimate "not found"
    if (error.code === "PGRST116") return null
    throw new Error(`Failed to resolve domain runtime for ${hostname}: ${error.message}`)
  }
  return data
}

export async function resolveDomainRuntime(hostname: string): Promise<DomainRuntime | null> {
  const app = await createAppClient("service")
  return resolveDomainRuntimeQuery(
    hostname,
    app.from("domains").select(DOMAIN_RUNTIME_SELECT).eq("hostname", hostname).single(),
  )
}

/**
 * In-memory cache for full domain records (5-min TTL).
 * Domain records (port, execution_mode, org_id) rarely change — caching
 * eliminates the Supabase round-trip on repeat requests to the same domain.
 */
interface FullDomainCacheEntry {
  record: FullDomainRecord | null
  expiresAt: number
}

const fullDomainCache = new Map<string, FullDomainCacheEntry>()
const FULL_DOMAIN_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const FULL_DOMAIN_CACHE_MAX_SIZE = 500

/**
 * Invalidate the full domain record cache for a specific hostname.
 * Call this when domain config changes (e.g., port reassignment, execution mode change).
 */
export function invalidateFullDomainCache(hostname: string): void {
  fullDomainCache.delete(hostname)
}

/**
 * Fetch the full domain record (runtime + org_id) in a single query.
 * Uses an in-memory cache with 5-min TTL to avoid hitting Supabase on every chat message.
 *
 * @returns FullDomainRecord or null if domain not found
 */
/** Evict expired entries when cache exceeds max size. */
function pruneFullDomainCache(now: number): void {
  if (fullDomainCache.size <= FULL_DOMAIN_CACHE_MAX_SIZE) return
  for (const [key, entry] of fullDomainCache) {
    if (entry.expiresAt <= now) fullDomainCache.delete(key)
  }
  // If still over limit after expiry sweep, drop oldest entries
  while (fullDomainCache.size > FULL_DOMAIN_CACHE_MAX_SIZE) {
    const firstKey = fullDomainCache.keys().next().value
    if (firstKey !== undefined) fullDomainCache.delete(firstKey)
  }
}

export async function fetchFullDomainRecord(hostname: string): Promise<FullDomainRecord | null> {
  const now = Date.now()
  const cached = fullDomainCache.get(hostname)
  if (cached && cached.expiresAt > now) {
    return cached.record
  }

  const app = await createAppClient("service")
  const { data, error }: FullDomainQueryResult = await app
    .from("domains")
    .select(FULL_DOMAIN_SELECT)
    .eq("hostname", hostname)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      // Cache negative result too (domain not found)
      pruneFullDomainCache(now)
      fullDomainCache.set(hostname, { record: null, expiresAt: now + FULL_DOMAIN_CACHE_TTL_MS })
      return null
    }
    throw new Error(`Failed to fetch full domain record for ${hostname}: ${error.message}`)
  }

  pruneFullDomainCache(now)
  fullDomainCache.set(hostname, { record: data, expiresAt: now + FULL_DOMAIN_CACHE_TTL_MS })
  return data
}
