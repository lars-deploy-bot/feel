#!/usr/bin/env node
/**
 * Verifies whether the Claude Agent SDK's canUseTool callback is actually invoked.
 *
 * As of SDK v0.2.41, canUseTool is NEVER called — the CLI auto-approves all tools.
 * Run this after SDK upgrades to check if Anthropic fixed it.
 *
 * Usage: node scripts/verify-canUseTool-callback.mjs [permissionMode]
 *
 * Expected output if still broken: "canUseTool called: 0 times"
 * Expected output if fixed:        "canUseTool called: N times" (N > 0)
 */
import { query } from "../node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs"

delete process.env.CLAUDECODE
const mode = process.argv[2] || "default"
console.log(`\nSDK canUseTool verification — permissionMode: "${mode}"\n`)

let canUseToolCount = 0

const q = query({
  prompt: "Read the file package.json and tell me the project name. Be brief, one line.",
  options: {
    model: "claude-sonnet-4-20250514",
    maxTurns: 2,
    permissionMode: mode,
    allowedTools: ["Read"],
    canUseTool: async (toolName, _input, _opts) => {
      canUseToolCount++
      console.log(`  [canUseTool #${canUseToolCount}] ${toolName}`)
      return { behavior: "allow" }
    },
    settingSources: [],
  },
})

try {
  for await (const msg of q) {
    if (msg.type === "assistant") {
      const toolUse = msg.message?.content?.filter((c) => c.type === "tool_use")
      if (toolUse?.length) toolUse.forEach((t) => console.log(`  [tool_use] ${t.name}`))
    } else if (msg.type === "result") {
      console.log(`  [result] ${msg.subtype}`)
    }
  }
} catch (e) {
  console.log(`  [ERROR] ${e.message}`)
}

console.log(`\n  canUseTool called: ${canUseToolCount} times`)
if (canUseToolCount === 0) {
  console.log("  STATUS: BROKEN — canUseTool is dead code, do NOT rely on it")
} else {
  console.log("  STATUS: WORKING — canUseTool is being called, security callback is active")
}
console.log()
