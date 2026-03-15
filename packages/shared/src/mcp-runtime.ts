import { GLOBAL_MCP_PROVIDERS, type GlobalMcpProviderRegistry } from "./mcp-providers.js"

const MCP_HTTP_PROBE_TIMEOUT_MS = 250
const MCP_HTTP_PROBE_CACHE_TTL_MS = 10_000

const probeCache = new Map<string, { checkedAt: number; reachable: boolean }>()

export interface ReachableGlobalMcpServersResult {
  filteredAllowedTools: string[]
  reachableServers: Record<string, { type: "http"; url: string }>
  skippedServers: string[]
}

function extractMcpServerKey(toolName: string): string | null {
  if (!toolName.startsWith("mcp__")) {
    return null
  }

  const prefixLength = "mcp__".length
  const nextSeparatorIndex = toolName.indexOf("__", prefixLength)
  if (nextSeparatorIndex === -1) {
    return null
  }

  return toolName.slice(prefixLength, nextSeparatorIndex)
}

async function probeGlobalMcpHttpServer(url: string): Promise<boolean> {
  const cached = probeCache.get(url)
  const now = Date.now()
  if (cached && now - cached.checkedAt < MCP_HTTP_PROBE_CACHE_TTL_MS) {
    return cached.reachable
  }

  let reachable = false
  try {
    await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(MCP_HTTP_PROBE_TIMEOUT_MS),
    })
    reachable = true
  } catch {
    reachable = false
  }

  probeCache.set(url, { checkedAt: now, reachable })
  return reachable
}

export async function resolveReachableGlobalMcpServers(
  allowedTools: readonly string[],
  options?: {
    globalProviders?: GlobalMcpProviderRegistry
    probeHttpServer?: (url: string) => Promise<boolean>
  },
): Promise<ReachableGlobalMcpServersResult> {
  const globalProviders: GlobalMcpProviderRegistry = options?.globalProviders ?? GLOBAL_MCP_PROVIDERS
  const probeHttpServer = options?.probeHttpServer ?? probeGlobalMcpHttpServer

  const referencedServerKeys = new Set<string>()
  for (const toolName of allowedTools) {
    const serverKey = extractMcpServerKey(toolName)
    if (serverKey && serverKey in globalProviders) {
      referencedServerKeys.add(serverKey)
    }
  }

  if (referencedServerKeys.size === 0) {
    return {
      filteredAllowedTools: [...allowedTools],
      reachableServers: {},
      skippedServers: [],
    }
  }

  const reachableServers: Record<string, { type: "http"; url: string }> = {}
  const skippedServers: string[] = []
  const reachableServerKeys = new Set<string>()

  await Promise.all(
    [...referencedServerKeys].map(async serverKey => {
      const providerConfig = globalProviders[serverKey]
      if (!providerConfig) {
        return
      }

      const reachable = await probeHttpServer(providerConfig.url)
      if (reachable) {
        reachableServerKeys.add(serverKey)
        reachableServers[serverKey] = {
          type: "http",
          url: providerConfig.url,
        }
        return
      }

      skippedServers.push(serverKey)
    }),
  )

  const filteredAllowedTools = allowedTools.filter(toolName => {
    const serverKey = extractMcpServerKey(toolName)
    if (!serverKey || !(serverKey in globalProviders)) {
      return true
    }
    return reachableServerKeys.has(serverKey)
  })

  skippedServers.sort()

  return {
    filteredAllowedTools,
    reachableServers,
    skippedServers,
  }
}
