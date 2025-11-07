import { existsSync, readFileSync } from "node:fs"

// Cache to avoid reading Caddyfile on every request
let cachedPorts: Map<string, number> | null = null
let cacheTime = 0
const CACHE_TTL = 60000 // 1 minute

/**
 * Parse Caddyfile to extract domain -> port mappings
 * Results are cached for 1 minute to avoid repeated file reads
 * @returns Map of workspace domain to localhost port
 */
export function getWorkspacePorts(): Map<string, number> {
  const caddyfilePath = "/root/webalive/claude-bridge/Caddyfile"

  // Return cached result if still valid
  const now = Date.now()
  if (cachedPorts && now - cacheTime < CACHE_TTL) {
    return cachedPorts
  }

  // Check if Caddyfile exists
  if (!existsSync(caddyfilePath)) {
    console.error(`Caddyfile not found at ${caddyfilePath}`)
    return new Map()
  }

  let caddyfileContent: string
  try {
    caddyfileContent = readFileSync(caddyfilePath, "utf-8")
  } catch (error) {
    console.error(`Failed to read Caddyfile: ${error}`)
    return new Map()
  }

  const portMap = new Map<string, number>()

  // Regex to match domain blocks with reverse_proxy directives
  // Example: "protino.alive.best {\n...\nreverse_proxy localhost:3357"
  const domainBlockRegex = /^([a-zA-Z0-9.-]+(?:,\s*[a-zA-Z0-9.-]+)*)\s*\{[\s\S]*?reverse_proxy\s+localhost:(\d+)/gm

  // Extract all domain->port mappings
  for (const match of caddyfileContent.matchAll(domainBlockRegex)) {
    const domains = match[1].split(",").map(d => d.trim())
    const port = parseInt(match[2], 10)

    for (const domain of domains) {
      portMap.set(domain, port)
    }
  }

  // Update cache
  cachedPorts = portMap
  cacheTime = now

  return portMap
}

/**
 * Get the localhost port for a given workspace domain
 * @param workspace - Domain name (e.g., "protino.alive.best")
 * @returns Port number or null if not found
 */
export function getWorkspacePort(workspace: string): number | null {
  const portMap = getWorkspacePorts()
  return portMap.get(workspace) ?? null
}
