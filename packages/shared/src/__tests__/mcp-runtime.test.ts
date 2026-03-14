import { describe, expect, it, vi } from "vitest"
import { resolveReachableGlobalMcpServers } from "../mcp-runtime.js"

describe("resolveReachableGlobalMcpServers", () => {
  it("keeps reachable global MCP servers and their tools", async () => {
    const result = await resolveReachableGlobalMcpServers(["mcp__context7__get-library-docs", "Read"], {
      probeHttpServer: vi.fn().mockResolvedValue(true),
    })

    expect(result.reachableServers).toEqual({
      context7: {
        type: "http",
        url: "http://localhost:8082/mcp",
      },
    })
    expect(result.filteredAllowedTools).toEqual(["mcp__context7__get-library-docs", "Read"])
    expect(result.skippedServers).toEqual([])
  })

  it("removes unreachable global MCP tools from the allowed list", async () => {
    const probeHttpServer = vi.fn(async (url: string) => url !== "http://localhost:8082/mcp")

    const result = await resolveReachableGlobalMcpServers(
      ["mcp__context7__get-library-docs", "mcp__google-scraper__search_google_maps", "Edit"],
      { probeHttpServer },
    )

    expect(result.reachableServers).toEqual({
      "google-scraper": {
        type: "http",
        url: "http://localhost:8083/mcp",
      },
    })
    expect(result.filteredAllowedTools).toEqual(["mcp__google-scraper__search_google_maps", "Edit"])
    expect(result.skippedServers).toEqual(["context7"])
  })

  it("does not probe when no global MCP tools are allowed", async () => {
    const probeHttpServer = vi.fn().mockResolvedValue(true)

    const result = await resolveReachableGlobalMcpServers(["Read", "Edit"], {
      probeHttpServer,
    })

    expect(probeHttpServer).not.toHaveBeenCalled()
    expect(result.reachableServers).toEqual({})
    expect(result.filteredAllowedTools).toEqual(["Read", "Edit"])
    expect(result.skippedServers).toEqual([])
  })
})
