/**
 * Port Resolver
 *
 * Maps workspace domains to localhost ports by reading the
 * generated port-map.json file. Caches with a short TTL since
 * the file is regenerated every 5 minutes by cron.
 */

import { readFileSync } from "node:fs"
import { z } from "zod"

const PORT_MAP_PATH = "/var/lib/alive/generated/port-map.json"
const CACHE_TTL_MS = 15_000 // 15 seconds

const portMapSchema = z.record(z.string(), z.number())

let cachedMap: Record<string, number> | null = null
let cachedAt = 0

function loadPortMap(): Record<string, number> {
  const now = Date.now()
  if (cachedMap && now - cachedAt < CACHE_TTL_MS) {
    return cachedMap
  }

  try {
    const raw = readFileSync(PORT_MAP_PATH, "utf-8")
    cachedMap = portMapSchema.parse(JSON.parse(raw))
    cachedAt = now
    return cachedMap
  } catch (err) {
    if (cachedMap) {
      // Return stale cache if file read fails
      return cachedMap
    }
    throw new Error(`Failed to read port map at ${PORT_MAP_PATH}: ${String(err)}`)
  }
}

/**
 * Resolve a domain to a localhost URL.
 *
 * @param domain - The workspace domain (e.g., "mysite.alive.best")
 * @param path - Optional URL path (e.g., "/about")
 * @returns Full localhost URL (e.g., "http://localhost:3507/about")
 * @throws If domain is not found in port map
 */
export function resolveUrl(domain: string, path?: string): string {
  const portMap = loadPortMap()
  const port = portMap[domain]

  if (port === undefined) {
    throw new Error(`Domain "${domain}" not found in port map. The site may not be deployed or the port map is stale.`)
  }

  const cleanPath = path ? (path.startsWith("/") ? path : `/${path}`) : ""
  return `http://localhost:${port}${cleanPath}`
}

/**
 * Check if a domain exists in the port map.
 */
export function isDomainKnown(domain: string): boolean {
  const portMap = loadPortMap()
  return domain in portMap
}
