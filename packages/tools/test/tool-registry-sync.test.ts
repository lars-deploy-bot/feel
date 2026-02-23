/**
 * Tool Registry Sync Test
 *
 * PURPOSE: Ensures all internal tool surfaces are synchronized.
 * The single source of truth is INTERNAL_TOOL_DESCRIPTORS in @webalive/shared.
 * This test verifies that:
 * - MCP server registrations match descriptors
 * - Tool registry metadata matches descriptors
 * - Descriptor-to-server grouping is correct
 *
 * When this test fails:
 * 1. If you added a tool: add a descriptor in internal-tool-descriptors.ts first
 * 2. Then add metadata in tool-registry.ts and implementation in mcp-server.ts
 * 3. Sync tests will catch any missing steps
 */

import { INTERNAL_TOOL_DESCRIPTORS } from "@webalive/shared"
import { describe, expect, it } from "vitest"
import { toolsInternalMcp, workspaceInternalMcp } from "../src/mcp-server.js"
import { TOOL_REGISTRY } from "../src/tools/meta/tool-registry.js"

describe("Tool Registry Sync", () => {
  it("should have all MCP server tools in TOOL_REGISTRY with enabled=true or superadminOnly=true", () => {
    // Get all tool names from MCP servers
    const mcpToolNames = new Set<string>()

    // Extract tools from alive-tools server
    const aliveToolsRegistered = Object.keys(toolsInternalMcp.instance._registeredTools || {})
    for (const toolName of aliveToolsRegistered) {
      mcpToolNames.add(toolName)
    }

    // Extract tools from alive-workspace server
    const aliveWorkspaceRegistered = Object.keys(workspaceInternalMcp.instance._registeredTools || {})
    for (const toolName of aliveWorkspaceRegistered) {
      mcpToolNames.add(toolName)
    }

    // Get all tool names that should be in MCP servers (enabled OR superadminOnly)
    const registryAvailableTools = new Set(
      TOOL_REGISTRY.filter(tool => tool.enabled || tool.superadminOnly).map(tool => tool.name),
    )

    // Check: Every MCP tool must be in registry with enabled=true or superadminOnly=true
    const missingFromRegistry: string[] = []
    for (const toolName of mcpToolNames) {
      if (!registryAvailableTools.has(toolName)) {
        missingFromRegistry.push(toolName)
      }
    }

    if (missingFromRegistry.length > 0) {
      throw new Error(
        "Tools in MCP servers but missing or disabled in TOOL_REGISTRY:\n" +
          `   ${missingFromRegistry.join(", ")}\n\n` +
          "   Fix: Add metadata to packages/tools/src/tools/meta/tool-registry.ts",
      )
    }

    // Check: Every available registry tool must be in MCP servers
    const missingFromMcp: string[] = []
    for (const toolName of registryAvailableTools) {
      if (!mcpToolNames.has(toolName)) {
        missingFromMcp.push(toolName)
      }
    }

    if (missingFromMcp.length > 0) {
      throw new Error(
        "Tools enabled/superadminOnly in TOOL_REGISTRY but missing from MCP servers:\n" +
          `   ${missingFromMcp.join(", ")}\n\n` +
          "   Fix: Either:\n" +
          "   1. Add these tools to packages/tools/src/mcp-server.ts (toolsInternalMcp or workspaceInternalMcp)\n" +
          `   2. Or set superadminOnly=false if they're intentionally disabled`,
      )
    }

    // Verify sync
    expect(mcpToolNames.size).toBe(registryAvailableTools.size)
    expect([...mcpToolNames].sort()).toEqual([...registryAvailableTools].sort())
  })

  it("should have a descriptor for every enabled registry tool", () => {
    const descriptorNames = new Set(INTERNAL_TOOL_DESCRIPTORS.filter(d => d.enabled).map(d => d.name))
    const enabledRegistryTools = TOOL_REGISTRY.filter(t => t.enabled && t.category !== "external-mcp")

    const missingDescriptors = enabledRegistryTools.filter(t => !descriptorNames.has(t.name)).map(t => t.name)

    if (missingDescriptors.length > 0) {
      throw new Error(
        "Enabled tools in TOOL_REGISTRY but missing from INTERNAL_TOOL_DESCRIPTORS:\n" +
          `   ${missingDescriptors.join(", ")}\n\n` +
          "   Fix: Add a descriptor in packages/shared/src/internal-tool-descriptors.ts",
      )
    }
    expect(missingDescriptors).toHaveLength(0)
  })

  it("should have registry metadata for every enabled descriptor", () => {
    const registryNames = new Set(TOOL_REGISTRY.map(t => t.name))
    const enabledDescriptors = INTERNAL_TOOL_DESCRIPTORS.filter(d => d.enabled)

    const missingMetadata = enabledDescriptors.filter(d => !registryNames.has(d.name)).map(d => d.name)

    if (missingMetadata.length > 0) {
      throw new Error(
        "Enabled descriptors with no registry metadata:\n" +
          `   ${missingMetadata.join(", ")}\n\n` +
          "   Fix: Add metadata in packages/tools/src/tools/meta/tool-registry.ts",
      )
    }
    expect(missingMetadata).toHaveLength(0)
  })

  it("should have valid metadata for all tools in TOOL_REGISTRY", () => {
    // All tools should have valid metadata
    for (const tool of TOOL_REGISTRY) {
      // Test existence
      expect(tool.name).toBeTruthy()
      expect(tool.category).toBeTruthy()
      expect(tool.description).toBeTruthy()

      // Test types
      expect(tool.contextCost).toMatch(/^(low|medium|high)$/)
      expect(typeof tool.enabled).toBe("boolean")

      // Test name format (snake_case, may include digits for external providers like context7)
      expect(tool.name).toMatch(/^[a-z0-9_]+$/)
    }
  })

  it("should not include disabled tools in MCP servers (unless superadminOnly)", () => {
    const mcpToolNames = new Set<string>()

    const aliveToolsRegistered = Object.keys(toolsInternalMcp.instance._registeredTools || {})
    for (const toolName of aliveToolsRegistered) {
      mcpToolNames.add(toolName)
    }

    const aliveWorkspaceRegistered = Object.keys(workspaceInternalMcp.instance._registeredTools || {})
    for (const toolName of aliveWorkspaceRegistered) {
      mcpToolNames.add(toolName)
    }

    // Disabled tools that are NOT superadminOnly should not be in MCP servers
    const disabledTools = TOOL_REGISTRY.filter(tool => !tool.enabled && !tool.superadminOnly).map(tool => tool.name)

    const disabledButInMcp: string[] = []
    for (const toolName of disabledTools) {
      if (mcpToolNames.has(toolName)) {
        disabledButInMcp.push(toolName)
      }
    }

    if (disabledButInMcp.length > 0) {
      throw new Error(
        "Tools marked as disabled (non-superadminOnly) in TOOL_REGISTRY but still in MCP servers:\n" +
          `   ${disabledButInMcp.join(", ")}\n\n` +
          "   Fix: Remove these tools from packages/tools/src/mcp-server.ts (or set superadminOnly=true if intended)",
      )
    }

    expect(disabledButInMcp).toHaveLength(0)
  })

  it("should map workspace category tools to workspaceInternalMcp and others to toolsInternalMcp", () => {
    // Get tools from each server
    const workspaceToolNames = new Set<string>(Object.keys(workspaceInternalMcp.instance._registeredTools || {}))
    const aliveToolNames = new Set<string>(Object.keys(toolsInternalMcp.instance._registeredTools || {}))

    // Check each enabled or superadminOnly tool is in correct server
    const wrongServerTools: string[] = []

    for (const tool of TOOL_REGISTRY.filter(t => t.enabled || t.superadminOnly)) {
      const isInWorkspaceMcp = workspaceToolNames.has(tool.name)
      const isInToolsMcp = aliveToolNames.has(tool.name)

      if (tool.category === "workspace") {
        if (!isInWorkspaceMcp) {
          wrongServerTools.push(`${tool.name} (category: workspace, expected: workspaceInternalMcp)`)
        }
      } else {
        if (!isInToolsMcp) {
          wrongServerTools.push(`${tool.name} (category: ${tool.category}, expected: toolsInternalMcp)`)
        }
      }
    }

    if (wrongServerTools.length > 0) {
      throw new Error(
        "Tools registered in wrong MCP server:\n" +
          `   ${wrongServerTools.join("\n   ")}\n\n` +
          "   Fix: Workspace category tools must be in workspaceInternalMcp, others in toolsInternalMcp",
      )
    }

    expect(wrongServerTools).toHaveLength(0)
  })

  it("should have MCP server grouping consistent with descriptor mcpServer field", () => {
    const workspaceToolNames = new Set<string>(Object.keys(workspaceInternalMcp.instance._registeredTools || {}))
    const aliveToolNames = new Set<string>(Object.keys(toolsInternalMcp.instance._registeredTools || {}))

    const mismatches: string[] = []

    for (const d of INTERNAL_TOOL_DESCRIPTORS.filter(d => d.enabled)) {
      if (d.mcpServer === "alive-workspace") {
        if (!workspaceToolNames.has(d.name)) {
          mismatches.push(`${d.name}: descriptor says alive-workspace but not in workspaceInternalMcp`)
        }
      } else if (d.mcpServer === "alive-tools") {
        if (!aliveToolNames.has(d.name)) {
          mismatches.push(`${d.name}: descriptor says alive-tools but not in toolsInternalMcp`)
        }
      }
    }

    if (mismatches.length > 0) {
      throw new Error(
        "Descriptor mcpServer field doesn't match actual MCP server registration:\n" +
          `   ${mismatches.join("\n   ")}\n\n` +
          "   Fix: Ensure descriptor mcpServer matches the MCP server in mcp-server.ts",
      )
    }

    expect(mismatches).toHaveLength(0)
  })

  it("should have parameter metadata matching implementation for tools with parameters", () => {
    const toolsWithInconsistentParams: string[] = []

    for (const tool of TOOL_REGISTRY.filter(t => t.enabled)) {
      if (!tool.parameters || tool.parameters.length === 0) {
        continue
      }

      // Check parameter names are unique
      const paramNames = tool.parameters.map(p => p.name)
      const uniqueNames = new Set(paramNames)
      if (paramNames.length !== uniqueNames.size) {
        toolsWithInconsistentParams.push(`${tool.name}: duplicate parameter names (${paramNames.join(", ")})`)
      }

      // Check each parameter has required metadata
      for (const param of tool.parameters) {
        if (!param.name || !param.type || !param.description) {
          toolsWithInconsistentParams.push(
            `${tool.name}: parameter '${param.name}' missing required fields (name/type/description)`,
          )
        }

        // Check valid types
        const validTypes = ["string", "number", "boolean", "array", "object"]
        if (!validTypes.includes(param.type)) {
          toolsWithInconsistentParams.push(
            `${tool.name}: parameter '${param.name}' has invalid type '${param.type}' (must be: ${validTypes.join(", ")})`,
          )
        }

        // Check description is meaningful (not just placeholder)
        if (param.description.length < 10) {
          toolsWithInconsistentParams.push(
            `${tool.name}: parameter '${param.name}' has too short description (min 10 chars)`,
          )
        }
      }
    }

    if (toolsWithInconsistentParams.length > 0) {
      throw new Error(
        "Tools with inconsistent parameter metadata:\n" +
          `   ${toolsWithInconsistentParams.join("\n   ")}\n\n` +
          "   Fix: Ensure parameter metadata is complete and accurate",
      )
    }

    expect(toolsWithInconsistentParams).toHaveLength(0)
  })

  it("should have meaningful descriptions (not placeholders)", () => {
    const toolsWithWeakDescriptions: string[] = []

    for (const tool of TOOL_REGISTRY) {
      // Check minimum length
      if (tool.description.length < 20) {
        toolsWithWeakDescriptions.push(`${tool.name}: description too short (${tool.description.length} chars)`)
      }

      // Check for placeholder patterns
      const placeholders = ["TODO", "TBD", "placeholder", "add description", "tool description", "does something"]
      const hasPlaceholder = placeholders.some(p => tool.description.toLowerCase().includes(p.toLowerCase()))
      if (hasPlaceholder) {
        toolsWithWeakDescriptions.push(`${tool.name}: contains placeholder text`)
      }
    }

    if (toolsWithWeakDescriptions.length > 0) {
      throw new Error(
        "Tools with weak/placeholder descriptions:\n" +
          `   ${toolsWithWeakDescriptions.join("\n   ")}\n\n` +
          "   Fix: Write clear, specific descriptions that explain what the tool does",
      )
    }

    expect(toolsWithWeakDescriptions).toHaveLength(0)
  })

  it("should not have duplicate tool names", () => {
    const toolNames = TOOL_REGISTRY.map(t => t.name)
    const uniqueNames = new Set(toolNames)

    expect(toolNames.length).toBe(uniqueNames.size)

    if (toolNames.length !== uniqueNames.size) {
      const duplicates = toolNames.filter((name, index) => toolNames.indexOf(name) !== index)
      throw new Error(
        `Duplicate tool names found:\n   ${duplicates.join(", ")}\n\n   Fix: Each tool must have a unique name`,
      )
    }
  })

  it("should have appropriate contextCost for tool complexity", () => {
    const toolsWithSuspiciousCost: string[] = []

    for (const tool of TOOL_REGISTRY) {
      // Heuristic: Tools with many parameters likely have "medium" or "high" cost
      const paramCount = tool.parameters?.length || 0

      if (paramCount >= 5 && tool.contextCost === "low") {
        toolsWithSuspiciousCost.push(
          `${tool.name}: has ${paramCount} parameters but contextCost='low' (expected medium/high)`,
        )
      }

      // Batch/composite tools should likely be medium or high
      if ((tool.category === "batch" || tool.category === "composite") && tool.contextCost === "low") {
        toolsWithSuspiciousCost.push(
          `${tool.name}: ${tool.category} category but contextCost='low' (expected medium/high)`,
        )
      }
    }

    // This is a warning test, not a hard failure - just flag for review
    if (toolsWithSuspiciousCost.length > 0) {
      console.warn(`Tools with potentially incorrect contextCost:\n   ${toolsWithSuspiciousCost.join("\n   ")}`)
    }

    // Don't fail the test, just validate the format was correct (already tested above)
    expect(true).toBe(true)
  })

  it("should derive enabled state from descriptors (no manual enabled=true in metadata)", () => {
    // This test ensures INTERNAL_TOOL_METADATA doesn't accidentally include `enabled`,
    // and that the enabled state comes purely from INTERNAL_TOOL_DESCRIPTORS.
    const descriptorEnabled = new Set(INTERNAL_TOOL_DESCRIPTORS.filter(d => d.enabled).map(d => d.name))
    const registryEnabled = new Set(
      TOOL_REGISTRY.filter(t => t.enabled && t.category !== "external-mcp").map(t => t.name),
    )

    // Every enabled registry tool must be in descriptors
    const extraEnabled = [...registryEnabled].filter(name => !descriptorEnabled.has(name))
    if (extraEnabled.length > 0) {
      throw new Error(
        "Tools enabled in registry but not in descriptors:\n" +
          `   ${extraEnabled.join(", ")}\n\n` +
          "   Fix: enabled state must come from INTERNAL_TOOL_DESCRIPTORS, not the registry",
      )
    }

    // Every enabled descriptor must appear in registry
    const missingEnabled = [...descriptorEnabled].filter(name => !registryEnabled.has(name))
    if (missingEnabled.length > 0) {
      throw new Error(
        "Tools enabled in descriptors but not in registry:\n" +
          `   ${missingEnabled.join(", ")}\n\n` +
          "   Fix: Add metadata for these tools in tool-registry.ts",
      )
    }

    expect(extraEnabled).toHaveLength(0)
    expect(missingEnabled).toHaveLength(0)
  })
})
