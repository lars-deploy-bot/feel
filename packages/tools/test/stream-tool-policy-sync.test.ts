import { INTERNAL_TOOL_DESCRIPTORS, isStreamPolicyTool, qualifiedMcpName } from "@webalive/shared"
import { describe, expect, it } from "vitest"
import { getEnabledMcpToolNames } from "../src/tools/meta/search-tools.js"

describe("stream tool policy sync", () => {
  it("requires a policy entry for every enabled internal MCP tool", () => {
    const internalTools = getEnabledMcpToolNames().filter(
      tool => tool.startsWith("mcp__alive-workspace__") || tool.startsWith("mcp__alive-tools__"),
    )

    const missingPolicies = internalTools.filter(tool => !isStreamPolicyTool(tool))
    expect(missingPolicies).toEqual([])
  })

  it("derives all enabled internal MCP tool names from INTERNAL_TOOL_DESCRIPTORS", () => {
    const fromDescriptors = INTERNAL_TOOL_DESCRIPTORS.filter(d => d.enabled).map(qualifiedMcpName)
    const fromGetEnabled = getEnabledMcpToolNames()

    expect(fromGetEnabled.sort()).toEqual(fromDescriptors.sort())
  })

  it("has a policy entry for every enabled descriptor", () => {
    const enabledDescriptors = INTERNAL_TOOL_DESCRIPTORS.filter(d => d.enabled)
    const missingPolicies = enabledDescriptors.map(qualifiedMcpName).filter(name => !isStreamPolicyTool(name))

    expect(missingPolicies).toEqual([])
  })
})
