#!/usr/bin/env node
/**
 * Test script to discover Stripe MCP tools
 */

import { query } from "@anthropic-ai/claude-agent-sdk"

const stripeMcp = {
  stripe: {
    type: "sse",
    url: "https://mcp.stripe.com",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_OAUTH_TOKEN || ""}`,
    },
  },
}

console.log("Testing Stripe MCP connection...")
console.log("Token:", process.env.STRIPE_OAUTH_TOKEN ? "present" : "MISSING")

try {
  const result = query({
    prompt: "List all available tools",
    options: {
      model: "claude-haiku-4-5",
      maxTurns: 1,
      mcpServers: stripeMcp,
    },
  })

  for await (const message of result) {
    console.log("Message type:", message.type, message.subtype || "")

    if (message.type === "system" && message.subtype === "init") {
      console.log("\n=== Available Tools ===")
      console.log(JSON.stringify(message.tools, null, 2))

      if (message.mcpServers) {
        console.log("\n=== MCP Servers Status ===")
        console.log(JSON.stringify(message.mcpServers, null, 2))
      }
    }

    if (message.type === "error") {
      console.error("Error message:", JSON.stringify(message, null, 2))
    }
  }
} catch (error) {
  console.error("Error:", error.message)
}
