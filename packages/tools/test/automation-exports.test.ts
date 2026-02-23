import { describe, expect, it } from "vitest"
import * as tools from "../src/index.js"

/**
 * Verifies that automation internals (createAutomation, triggerAutomation)
 * are NOT exported from the package root.
 *
 * These functions are used internally by MCP tool definitions but should not
 * be part of the public API surface. Consumers interact via MCP, not direct imports.
 *
 * listAutomations is also internal — only listAutomationsTool (registered in
 * the MCP server) is the public surface.
 */
describe("@webalive/tools automation export boundary", () => {
  const exportedKeys = Object.keys(tools)

  it("does not export createAutomation", () => {
    expect(exportedKeys).not.toContain("createAutomation")
  })

  it("does not export createAutomationParamsSchema", () => {
    expect(exportedKeys).not.toContain("createAutomationParamsSchema")
  })

  it("does not export triggerAutomation", () => {
    expect(exportedKeys).not.toContain("triggerAutomation")
  })

  it("does not export triggerAutomationParamsSchema", () => {
    expect(exportedKeys).not.toContain("triggerAutomationParamsSchema")
  })

  it("does not export listAutomations", () => {
    expect(exportedKeys).not.toContain("listAutomations")
  })

  it("does not export listAutomationsParamsSchema", () => {
    expect(exportedKeys).not.toContain("listAutomationsParamsSchema")
  })

  it("still exports the AUTOMATION tool name constant", () => {
    expect(exportedKeys).toContain("AUTOMATION")
  })

  it("still exports MCP server entries that include automation tools", () => {
    expect(exportedKeys).toContain("toolsInternalMcp")
  })
})
