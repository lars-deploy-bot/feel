import { describe, expect, it } from "vitest"
import { SUPERADMIN } from "../config"
import {
  buildStreamToolRuntimeConfig,
  createStreamCanUseTool,
  createStreamToolContext,
  filterToolsForMode,
  getStreamAllowedTools,
  getStreamDisallowedTools,
  getStreamToolDecision,
  getToolActionLabel,
  getToolDetail,
  isHeavyBashCommand,
  isStreamClientVisibleTool,
  isStreamInitVisibleTool,
  isStreamPolicyTool,
  resolveStreamMode,
} from "../tools/stream-tools"
import { getWorkspacePath } from "../tools/stream-tools-server"

describe("isHeavyBashCommand", () => {
  it("flags known heavy monorepo commands", () => {
    expect(isHeavyBashCommand("npx tsc --noEmit --project apps/web/tsconfig.json")).toBe(true)
    expect(isHeavyBashCommand("tsc -p tsconfig.json")).toBe(true)
    expect(isHeavyBashCommand("turbo run type-check")).toBe(true)
    expect(isHeavyBashCommand("next build")).toBe(true)
    expect(isHeavyBashCommand("bun run static-check")).toBe(true)
    expect(isHeavyBashCommand('claude --print "hello"')).toBe(true)
  })

  it("flags chained commands if any segment is heavy", () => {
    expect(isHeavyBashCommand("ls && tsc -p tsconfig.json")).toBe(true)
    expect(isHeavyBashCommand("echo hi; claude --print foo")).toBe(true)
    expect(isHeavyBashCommand("echo hi | tsc --noEmit")).toBe(true)
  })

  it("flags wrapped and case-insensitive heavy commands", () => {
    expect(isHeavyBashCommand("bash -c 'tsc -p tsconfig.json'")).toBe(true)
    expect(isHeavyBashCommand("TSC -p tsconfig.json")).toBe(true)
    expect(isHeavyBashCommand("cmd && ./CLAUDE --print foo")).toBe(true)
  })

  it("returns false for empty, whitespace, and non-string inputs", () => {
    expect(isHeavyBashCommand("")).toBe(false)
    expect(isHeavyBashCommand("   ")).toBe(false)
    expect(isHeavyBashCommand(undefined)).toBe(false)
    expect(isHeavyBashCommand(null)).toBe(false)
    expect(isHeavyBashCommand(42)).toBe(false)
  })

  it("allows lightweight commands", () => {
    expect(isHeavyBashCommand("ls -la")).toBe(false)
    expect(isHeavyBashCommand("bun run test app/api/health/route.test.ts")).toBe(false)
    expect(isHeavyBashCommand("rg --files")).toBe(false)
    expect(isHeavyBashCommand("cat tsconfig.json")).toBe(false)
    expect(isHeavyBashCommand("echo claude")).toBe(false)
    expect(isHeavyBashCommand("grep claude file.txt")).toBe(false)
  })

  it("allows site-scoped commands (turbo pattern catches monorepo-wide runs)", () => {
    expect(isHeavyBashCommand("bun run build")).toBe(false)
    expect(isHeavyBashCommand("bun run lint")).toBe(false)
    expect(isHeavyBashCommand("bun run type-check")).toBe(false)
    expect(isHeavyBashCommand("npm run build")).toBe(false)
    expect(isHeavyBashCommand("npm run lint")).toBe(false)
    expect(isHeavyBashCommand("npm run type-check")).toBe(false)
    expect(isHeavyBashCommand("pnpm run build")).toBe(false)
    expect(isHeavyBashCommand("pnpm run lint")).toBe(false)
    expect(isHeavyBashCommand("yarn build")).toBe(false)
    expect(isHeavyBashCommand("yarn lint")).toBe(false)
  })
})

describe("tool display helpers", () => {
  it("returns action labels case-insensitively", () => {
    expect(getToolActionLabel("Read")).toBe("reading")
    expect(getToolActionLabel("read")).toBe("reading")
    expect(getToolActionLabel("WEBFETCH")).toBe("fetching")
    expect(getToolActionLabel("UnknownTool")).toBe("unknowntool")
  })

  it("extracts file details from file_path and path", () => {
    expect(getToolDetail("Read", { file_path: "/tmp/src/App.tsx" })).toBe("App.tsx")
    expect(getToolDetail("edit", { file_path: "C:\\work\\index.ts" })).toBe("index.ts")
    expect(getToolDetail("write", { path: "/tmp/legacy/path.txt" })).toBe("path.txt")
  })

  it("extracts grep/glob, task, and bash details", () => {
    expect(getToolDetail("Grep", { pattern: "TODO" })).toBe("TODO")
    expect(getToolDetail("glob", { pattern: "**/*.tsx" })).toBe("**/*.tsx")
    expect(getToolDetail("Task", { description: "Refactor auth flow" })).toBe("Refactor auth flow")
    expect(getToolDetail("Bash", { command: "bun run test --watch\necho done" })).toBe("bun")
    expect(getToolDetail("Bash", { command: "bun run test --watch" }, { bashDetail: "firstLine" })).toBe(
      "bun run test --watch",
    )
  })

  it("extracts webfetch hostnames and falls back safely", () => {
    expect(getToolDetail("WebFetch", { url: "https://www.example.com/docs" })).toBe("example.com")
    expect(getToolDetail("webfetch", { url: "example.com/docs" })).toBe("example.com")
    expect(getToolDetail("webfetch", { url: "not a valid url" }, { webFetchFallbackMaxChars: 10 })).toBe(
      "not a vali...",
    )
  })

  it("fails closed on malformed input shapes", () => {
    expect(getToolDetail("Read", undefined)).toBeNull()
    expect(getToolDetail("Read", null)).toBeNull()
    expect(getToolDetail("Read", 42)).toBeNull()
    expect(getToolDetail("Read", { file_path: 123 })).toBeNull()
    expect(getToolDetail("UnknownTool", { file_path: "/tmp/x.ts" })).toBeNull()
  })
})

describe("resolveStreamMode", () => {
  it("keeps superadmin mode for superadmin users", () => {
    expect(resolveStreamMode("superadmin", { isSuperadmin: true })).toBe("superadmin")
  })

  it("downgrades superadmin mode for non-superadmin users", () => {
    expect(resolveStreamMode("superadmin", { isAdmin: true, isSuperadmin: false })).toBe("default")
    expect(resolveStreamMode("superadmin", { isAdmin: false, isSuperadmin: false })).toBe("default")
  })

  it("accepts plan mode for any role", () => {
    expect(resolveStreamMode("plan", { isAdmin: false, isSuperadmin: false })).toBe("plan")
  })

  it("falls back to default for invalid modes", () => {
    expect(resolveStreamMode("invalid-mode", { isSuperadmin: true })).toBe("default")
  })
})

describe("getWorkspacePath", () => {
  it("returns site user directory for regular domains", () => {
    const result = getWorkspacePath("example.com")
    expect(result).toContain("example.com/user")
  })

  it("returns SUPERADMIN.WORKSPACE_PATH for alive workspace", () => {
    const result = getWorkspacePath("alive")
    expect(result).toBe(SUPERADMIN.WORKSPACE_PATH)
    expect(result).not.toContain("/user")
  })
})

describe("stream tool role policy", () => {
  const enabledMcpTools = () => [
    "mcp__alive-sandboxed-fs__Read",
    "mcp__alive-sandboxed-fs__Write",
    "mcp__alive-sandboxed-fs__Edit",
    "mcp__alive-sandboxed-fs__Glob",
    "mcp__alive-sandboxed-fs__Grep",
    "mcp__alive-sandboxed-fs__Bash",
    "mcp__alive-sandboxed-fs__NotebookEdit",
    "mcp__alive-workspace__check_codebase",
    "mcp__alive-workspace__browser",
    "mcp__alive-tools__search_tools",
    "mcp__stripe__search_docs",
  ]

  it("gives member role default SDK tools and blocks admin/superadmin extras", () => {
    const allowed = getStreamAllowedTools(enabledMcpTools, false, false, false, "default", [], "systemd")
    const disallowed = getStreamDisallowedTools(false, false, "default", false, "systemd")

    // Regular site members get SDK built-in tools directly (no sandboxed-fs swap)
    expect(allowed).toContain("Read")
    expect(allowed).toContain("Write")
    expect(allowed).toContain("Edit")
    expect(allowed).toContain("Glob")
    expect(allowed).toContain("Grep")
    expect(allowed).toContain("Bash")
    expect(allowed).toContain("NotebookEdit")
    expect(allowed).not.toContain("mcp__alive-sandboxed-fs__Read")
    expect(allowed).toContain("TodoWrite")
    expect(disallowed).toContain("AskUserQuestion") // restricted to plan/superadmin mode
    expect(allowed).toContain("ListMcpResources")
    expect(allowed).toContain("ReadMcpResource")
    expect(disallowed).toContain("TaskStop")
    expect(disallowed).toContain("Task")
    expect(disallowed).toContain("WebSearch")
    // ExitPlanMode is in allowedTools (so SDK registers it) but denied by canUseTool
    expect(disallowed).not.toContain("ExitPlanMode")
    expect(allowed).toContain("ExitPlanMode")
    expect(disallowed).not.toContain("ListMcpResources")
    expect(disallowed).not.toContain("ReadMcpResource")
  })

  it("gives admin role TaskStop and hides member-only MCP resource tools", () => {
    const allowed = getStreamAllowedTools(enabledMcpTools, true, false, false, "default", [], "systemd")
    const disallowed = getStreamDisallowedTools(true, false, "default", false, "systemd")

    // Regular site admins get SDK built-in tools directly (no sandboxed-fs swap)
    expect(allowed).toContain("Read")
    expect(allowed).not.toContain("mcp__alive-sandboxed-fs__Read")
    expect(allowed).toContain("TaskStop")
    expect(allowed).not.toContain("ListMcpResources")
    expect(allowed).not.toContain("ReadMcpResource")
    expect(disallowed).toContain("Task")
    expect(disallowed).toContain("WebSearch")
    // ExitPlanMode is in allowedTools (so SDK registers it) but denied by canUseTool
    expect(disallowed).not.toContain("ExitPlanMode")
    expect(allowed).toContain("ExitPlanMode")
  })

  it("gives superadmin Task/WebSearch but still hides member-only MCP resource tools", () => {
    const allowed = getStreamAllowedTools(enabledMcpTools, true, true, false, "default", [], "systemd")
    const disallowed = getStreamDisallowedTools(true, true, "default", false, "systemd")

    expect(allowed).toContain("Read")
    expect(allowed).not.toContain("mcp__alive-sandboxed-fs__Read")
    expect(disallowed).not.toContain("Read")
    expect(allowed).toContain("Task")
    expect(allowed).toContain("WebSearch")
    expect(allowed).toContain("TodoWrite")
    expect(disallowed).toContain("AskUserQuestion") // restricted to plan/superadmin mode, not role
    expect(allowed).not.toContain("ListMcpResources")
    expect(allowed).not.toContain("ReadMcpResource")
    // ExitPlanMode is in allowedTools (so SDK registers it) but denied by canUseTool
    expect(disallowed).not.toContain("ExitPlanMode")
    expect(allowed).toContain("ExitPlanMode")
    expect(disallowed).not.toContain("Task")
    expect(disallowed).not.toContain("WebSearch")
  })

  it("filters site-specific workspace MCP tools in superadmin workspace", () => {
    const allowed = getStreamAllowedTools(enabledMcpTools, true, true, true, "default", [], "systemd")

    expect(allowed).not.toContain("mcp__alive-workspace__check_codebase")
    expect(allowed).toContain("mcp__alive-workspace__browser")
    expect(allowed).toContain("mcp__alive-tools__search_tools")
  })

  it("hides TodoWrite from client visibility while still allowing execution", () => {
    const context = createStreamToolContext({ executionMode: "systemd" })
    const decision = getStreamToolDecision("TodoWrite", context)

    expect(decision.executable).toBe(true)
    expect(decision.visibleToClient).toBe(false)
    expect(isStreamClientVisibleTool("TodoWrite")).toBe(false)
  })

  it("treats external MCP tools as policy tools via MCP bridge policy inheritance", () => {
    expect(isStreamPolicyTool("mcp__google-scraper__search_google_maps")).toBe(true)
  })

  it("restricts AskUserQuestion to plan and superadmin modes", () => {
    const defaultMode = getStreamToolDecision("AskUserQuestion", createStreamToolContext({ executionMode: "systemd" }))
    const planMode = getStreamToolDecision(
      "AskUserQuestion",
      createStreamToolContext({ executionMode: "systemd", mode: "plan" }),
    )
    const superadminMode = getStreamToolDecision(
      "AskUserQuestion",
      createStreamToolContext({ executionMode: "systemd", mode: "superadmin" }),
    )

    expect(defaultMode.executable).toBe(false)
    expect(planMode.executable).toBe(true)
    expect(superadminMode.executable).toBe(true)
  })

  it("blocks ExitPlanMode for all roles", () => {
    const member = getStreamToolDecision("ExitPlanMode", createStreamToolContext({ executionMode: "systemd" }))
    const admin = getStreamToolDecision(
      "ExitPlanMode",
      createStreamToolContext({ executionMode: "systemd", isAdmin: true }),
    )
    const superadmin = getStreamToolDecision(
      "ExitPlanMode",
      createStreamToolContext({ executionMode: "systemd", isAdmin: true, isSuperadmin: true }),
    )

    expect(member.executable).toBe(false)
    expect(admin.executable).toBe(false)
    expect(superadmin.executable).toBe(false)
  })

  it("enforces member-only MCP resource SDK tools", () => {
    const member = createStreamToolContext({ executionMode: "systemd" })
    const admin = createStreamToolContext({ executionMode: "systemd", isAdmin: true })
    const superadmin = createStreamToolContext({ executionMode: "systemd", isAdmin: true, isSuperadmin: true })

    expect(getStreamToolDecision("ListMcpResources", member).executable).toBe(true)
    expect(getStreamToolDecision("ReadMcpResource", member).executable).toBe(true)
    expect(getStreamToolDecision("ListMcpResources", admin).executable).toBe(false)
    expect(getStreamToolDecision("ReadMcpResource", admin).executable).toBe(false)
    expect(getStreamToolDecision("ListMcpResources", superadmin).executable).toBe(false)
    expect(getStreamToolDecision("ReadMcpResource", superadmin).executable).toBe(false)
  })

  it("blocks write/edit tools in plan mode at config-build time", () => {
    const context = createStreamToolContext({ executionMode: "systemd", mode: "plan" })
    const runtime = buildStreamToolRuntimeConfig(enabledMcpTools, context)

    // Plan mode: SDK read-only tools allowed, write tools blocked
    expect(runtime.allowedTools).toContain("Read")
    expect(runtime.allowedTools).toContain("Glob")
    expect(runtime.allowedTools).toContain("Grep")
    expect(runtime.allowedTools).not.toContain("Write")
    expect(runtime.allowedTools).not.toContain("Edit")
    expect(runtime.allowedTools).not.toContain("Bash")
    expect(runtime.allowedTools).not.toContain("mcp__google-scraper__search_google_maps")
    expect(runtime.allowedTools).not.toContain("mcp__alive-workspace__browser")
    expect(runtime.disallowedTools).toContain("Write")
    expect(runtime.disallowedTools).toContain("Edit")
  })

  it("blocks external MCP tool invocations in plan mode even with connected providers", async () => {
    const context = createStreamToolContext({ executionMode: "systemd", mode: "plan", connectedProviders: ["outlook"] })
    const canUseTool = createStreamCanUseTool(context, [])
    const result = await canUseTool(
      "mcp__outlook__search_emails",
      {},
      { signal: new AbortController().signal, toolUseID: "tool-use-1" },
    )

    expect(result.behavior).toBe("deny")
  })

  it("keeps OAuth external MCP invocations available outside plan mode when provider is connected", async () => {
    const context = createStreamToolContext({ executionMode: "systemd", connectedProviders: ["outlook"] })
    const canUseTool = createStreamCanUseTool(context, [])
    const result = await canUseTool(
      "mcp__outlook__search_emails",
      {},
      { signal: new AbortController().signal, toolUseID: "tool-use-2" },
    )

    expect(result.behavior).toBe("allow")
  })

  it("filterToolsForMode keeps only plan-allowed tools", () => {
    const filtered = filterToolsForMode(
      ["Read", "mcp__alive-sandboxed-fs__Read", "mcp__google-scraper__search_google_maps"],
      "plan",
    )
    expect(filtered).toEqual(["Read", "mcp__alive-sandboxed-fs__Read"])
  })

  it("hides OAuth MCP tools from init payload in plan mode even when connected", () => {
    const context = createStreamToolContext({ executionMode: "systemd", mode: "plan", connectedProviders: ["outlook"] })
    const visible = isStreamInitVisibleTool("mcp__outlook__search_emails", context, [])
    expect(visible).toBe(false)
  })

  it("keeps OAuth MCP tools visible in init payload outside plan mode when connected", () => {
    const context = createStreamToolContext({ executionMode: "systemd", connectedProviders: ["outlook"] })
    const visible = isStreamInitVisibleTool("mcp__outlook__search_emails", context, [])
    expect(visible).toBe(true)
  })

  it("allows only bash tools in superadmin mode", () => {
    const context = createStreamToolContext({
      executionMode: "systemd",
      mode: "superadmin",
      isSuperadmin: true,
      isSuperadminWorkspace: true,
    })
    const runtime = buildStreamToolRuntimeConfig(enabledMcpTools, context)

    expect(runtime.allowedTools).toContain("Bash")
    expect(runtime.allowedTools).toContain("BashOutput")
    expect(runtime.allowedTools).toContain("AskUserQuestion")
    expect(runtime.allowedTools).not.toContain("Read")
    expect(runtime.allowedTools).not.toContain("Write")
    expect(runtime.allowedTools).not.toContain("Edit")
    expect(runtime.allowedTools).not.toContain("Glob")
    expect(runtime.allowedTools).not.toContain("mcp__alive-tools__search_tools")
  })

  it("keeps superadmin mode bash-only even in site workspaces", () => {
    const context = createStreamToolContext({
      executionMode: "systemd",
      mode: "superadmin",
      isSuperadmin: true,
      isSuperadminWorkspace: false,
    })
    const runtime = buildStreamToolRuntimeConfig(enabledMcpTools, context)

    expect(runtime.allowedTools).toContain("Bash")
    expect(runtime.allowedTools).toContain("BashOutput")
    expect(runtime.allowedTools).not.toContain("Read")
    expect(runtime.allowedTools).not.toContain("mcp__alive-tools__search_tools")
  })

  it("fails closed for internal tools that have no policy entry", () => {
    const missingPolicyTool = "mcp__alive-tools__missing_policy_tool"
    const decision = getStreamToolDecision(missingPolicyTool, createStreamToolContext({ executionMode: "systemd" }))

    expect(decision.executable).toBe(false)
    expect(decision.policyFound).toBe(false)
    expect(isStreamClientVisibleTool(missingPolicyTool)).toBe(false)
  })

  it("fails closed for unknown mcp__alive-* namespaces", () => {
    const unknownInternalTool = "mcp__alive-foo__missing_policy_tool"
    const decision = getStreamToolDecision(unknownInternalTool, createStreamToolContext({ executionMode: "systemd" }))

    expect(decision.executable).toBe(false)
    expect(decision.policyFound).toBe(false)
    expect(isStreamClientVisibleTool(unknownInternalTool)).toBe(false)
  })

  // ===========================================================================
  // E2B sandbox isolation — SDK file tools and sandboxed-fs are mutually exclusive
  // ===========================================================================

  const SDK_FILE_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "NotebookEdit"]

  const e2bMcpTools = () => [
    "mcp__alive-sandboxed-fs__Read",
    "mcp__alive-sandboxed-fs__Write",
    "mcp__alive-sandboxed-fs__Edit",
    "mcp__alive-sandboxed-fs__Glob",
    "mcp__alive-sandboxed-fs__Grep",
    "mcp__alive-sandboxed-fs__Bash",
    "mcp__alive-sandboxed-fs__NotebookEdit",
    "mcp__alive-workspace__browser",
    "mcp__alive-tools__search_tools",
  ]

  it("E2B workspace: denies SDK file/shell tools by policy", () => {
    const e2bContext = createStreamToolContext({ executionMode: "e2b" })

    for (const tool of SDK_FILE_TOOLS) {
      const decision = getStreamToolDecision(tool, e2bContext)
      expect(decision.executable).toBe(false)
      expect(decision.reason).toContain("E2B")
    }
  })

  it("E2B workspace: allows sandboxed-fs tools", () => {
    const e2bContext = createStreamToolContext({ executionMode: "e2b" })

    for (const tool of [
      "mcp__alive-sandboxed-fs__Read",
      "mcp__alive-sandboxed-fs__Write",
      "mcp__alive-sandboxed-fs__Edit",
      "mcp__alive-sandboxed-fs__Glob",
      "mcp__alive-sandboxed-fs__Grep",
      "mcp__alive-sandboxed-fs__Bash",
      "mcp__alive-sandboxed-fs__NotebookEdit",
    ]) {
      const decision = getStreamToolDecision(tool, e2bContext)
      expect(decision.executable).toBe(true)
    }
  })

  it("E2B workspace: SDK file tools and sandboxed-fs are mutually exclusive in allowedTools", () => {
    const e2bContext = createStreamToolContext({ executionMode: "e2b" })
    const runtime = buildStreamToolRuntimeConfig(e2bMcpTools, e2bContext)

    // Sandboxed-fs tools are allowed
    expect(runtime.allowedTools).toContain("mcp__alive-sandboxed-fs__Read")
    expect(runtime.allowedTools).toContain("mcp__alive-sandboxed-fs__Write")
    expect(runtime.allowedTools).toContain("mcp__alive-sandboxed-fs__Bash")

    // SDK file tools are denied
    for (const tool of SDK_FILE_TOOLS) {
      expect(runtime.allowedTools).not.toContain(tool)
    }
  })

  it("regular site workspace: SDK file tools allowed, no sandboxed-fs", () => {
    const siteContext = createStreamToolContext({ executionMode: "systemd", isSuperadminWorkspace: false })
    const runtime = buildStreamToolRuntimeConfig(e2bMcpTools, siteContext)

    // SDK file tools are allowed
    for (const tool of SDK_FILE_TOOLS) {
      expect(runtime.allowedTools).toContain(tool)
    }

    // Sandboxed-fs tools are NOT allowed (workspaceKind mismatch)
    expect(runtime.allowedTools).not.toContain("mcp__alive-sandboxed-fs__Read")
    expect(runtime.allowedTools).not.toContain("mcp__alive-sandboxed-fs__Write")
    expect(runtime.allowedTools).not.toContain("mcp__alive-sandboxed-fs__Bash")
  })

  it("non-file SDK tools remain available in E2B mode", () => {
    const e2bContext = createStreamToolContext({ executionMode: "e2b" })
    const runtime = buildStreamToolRuntimeConfig(e2bMcpTools, e2bContext)

    expect(runtime.allowedTools).toContain("TodoWrite")
    expect(runtime.allowedTools).toContain("Mcp")
    expect(runtime.allowedTools).toContain("BashOutput")
    expect(runtime.allowedTools).toContain("TaskOutput")
    expect(runtime.allowedTools).toContain("Skill")
  })
})
