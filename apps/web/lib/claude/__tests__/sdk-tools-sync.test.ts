import { describe, expect, it } from "vitest"
import { ALLOWED_SDK_TOOLS, DISALLOWED_SDK_TOOLS, SDK_TOOL_NAMES } from "../sdk-tools-sync"

describe("SDK Tools Sync", () => {
  describe("Array completeness", () => {
    it("should have all SDK tools categorized (allowed + disallowed = all)", () => {
      const allCategorized = new Set([...ALLOWED_SDK_TOOLS, ...DISALLOWED_SDK_TOOLS])
      const allSDK = new Set(SDK_TOOL_NAMES)

      expect(allCategorized.size).toBe(allSDK.size)

      // Check for missing tools
      const missing = SDK_TOOL_NAMES.filter(t => !allCategorized.has(t))
      expect(missing).toEqual([])
    })

    it("should not have extra tools that are not in SDK", () => {
      const allSDK = new Set(SDK_TOOL_NAMES)

      const extraInAllowed = ALLOWED_SDK_TOOLS.filter(t => !allSDK.has(t))
      const extraInDisallowed = DISALLOWED_SDK_TOOLS.filter(t => !allSDK.has(t))

      expect(extraInAllowed).toEqual([])
      expect(extraInDisallowed).toEqual([])
    })
  })

  describe("No overlaps", () => {
    it("should not have any tool in both allowed and disallowed", () => {
      const allowed = new Set<string>(ALLOWED_SDK_TOOLS)
      const disallowed = new Set<string>(DISALLOWED_SDK_TOOLS)

      const overlapFromAllowed = ALLOWED_SDK_TOOLS.filter(t => disallowed.has(t))
      const overlapFromDisallowed = DISALLOWED_SDK_TOOLS.filter(t => allowed.has(t))
      expect(overlapFromAllowed).toEqual([])
      expect(overlapFromDisallowed).toEqual([])
    })
  })

  describe("No duplicates", () => {
    it("should not have duplicates in ALLOWED_SDK_TOOLS", () => {
      const unique = new Set(ALLOWED_SDK_TOOLS)
      expect(unique.size).toBe(ALLOWED_SDK_TOOLS.length)
    })

    it("should not have duplicates in DISALLOWED_SDK_TOOLS", () => {
      const unique = new Set(DISALLOWED_SDK_TOOLS)
      expect(unique.size).toBe(DISALLOWED_SDK_TOOLS.length)
    })

    it("should not have duplicates in SDK_TOOL_NAMES", () => {
      const unique = new Set(SDK_TOOL_NAMES)
      expect(unique.size).toBe(SDK_TOOL_NAMES.length)
    })
  })

  describe("SDK tool count", () => {
    it("should have exactly 18 SDK tools (as of v0.1.53)", () => {
      // This test will fail if SDK adds/removes tools, prompting an update
      expect(SDK_TOOL_NAMES.length).toBe(18)
    })

    it("should have correct tool counts in categories", () => {
      // 13 allowed + 5 disallowed = 18 total
      expect(ALLOWED_SDK_TOOLS.length).toBe(13)
      expect(DISALLOWED_SDK_TOOLS.length).toBe(5)
      expect(ALLOWED_SDK_TOOLS.length + DISALLOWED_SDK_TOOLS.length).toBe(SDK_TOOL_NAMES.length)
    })
  })

  describe("Expected tools are in correct categories", () => {
    const allowedSet = new Set<string>(ALLOWED_SDK_TOOLS)
    const disallowedSet = new Set<string>(DISALLOWED_SDK_TOOLS)
    const isAllowed = (tool: string) => allowedSet.has(tool)
    const isDisallowed = (tool: string) => disallowedSet.has(tool)

    it("should allow file operation tools", () => {
      expect(isAllowed("Read")).toBe(true)
      expect(isAllowed("Write")).toBe(true)
      expect(isAllowed("Edit")).toBe(true)
      expect(isAllowed("Glob")).toBe(true)
      expect(isAllowed("Grep")).toBe(true)
    })

    it("should disallow shell access tools", () => {
      expect(isDisallowed("Bash")).toBe(true)
      expect(isDisallowed("BashOutput")).toBe(true)
      expect(isDisallowed("KillShell")).toBe(true)
    })

    it("should disallow subagent spawning", () => {
      expect(isDisallowed("Task")).toBe(true)
    })

    it("should disallow web search", () => {
      expect(isDisallowed("WebSearch")).toBe(true)
    })

    it("should allow MCP tools", () => {
      expect(isAllowed("Mcp")).toBe(true)
      expect(isAllowed("ListMcpResources")).toBe(true)
      expect(isAllowed("ReadMcpResource")).toBe(true)
    })

    it("should allow planning/workflow tools", () => {
      expect(isAllowed("ExitPlanMode")).toBe(true)
      expect(isAllowed("TodoWrite")).toBe(true)
    })

    it("should allow other safe tools", () => {
      expect(isAllowed("NotebookEdit")).toBe(true)
      expect(isAllowed("WebFetch")).toBe(true)
      expect(isAllowed("AskUserQuestion")).toBe(true)
    })
  })
})
