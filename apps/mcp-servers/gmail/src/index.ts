#!/usr/bin/env node
/**
 * Gmail MCP Server
 *
 * A standalone MCP server that provides Gmail functionality.
 * Accepts Bearer tokens via HTTP Authorization header.
 *
 * Usage:
 *   node dist/index.js --transport http --port 8085
 *
 * This server is designed to work with our multi-tenant OAuth system
 * where tokens are stored in Supabase and passed via HTTP headers.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { Command } from "commander"
import express from "express"
import { createGmailClient } from "./gmail-client.js"
import { tools, executeTool } from "./tools/index.js"

const DEFAULT_PORT = 8085

// Parse CLI arguments
const program = new Command()
  .option("--transport <stdio|http>", "transport type", "http")
  .option("--port <number>", "port for HTTP transport", DEFAULT_PORT.toString())
  .allowUnknownOption()
  .parse(process.argv)

const cliOptions = program.opts()

// Validate transport option
const allowedTransports = ["stdio", "http"]
if (!allowedTransports.includes(cliOptions.transport)) {
  console.error(`Invalid --transport value: '${cliOptions.transport}'. Must be one of: stdio, http.`)
  process.exit(1)
}

const TRANSPORT_TYPE = cliOptions.transport as "stdio" | "http"
const PORT = parseInt(cliOptions.port, 10) || DEFAULT_PORT

/**
 * Create MCP server with Gmail client injected
 */
function createServer(accessToken?: string) {
  const server = new Server(
    {
      name: "gmail",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  )

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools }
  })

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: args } = request.params

    if (!accessToken) {
      return {
        content: [
          { type: "text", text: "Error: No access token provided. Include Authorization: Bearer <token> header." },
        ],
        isError: true,
      }
    }

    const gmail = createGmailClient(accessToken)
    return await executeTool(gmail, name, args || {})
  })

  return server
}

async function startStdioServer() {
  // For stdio, we can't get the token from headers
  // This mode is mainly for testing
  console.error("Warning: stdio mode does not support authentication. Use HTTP mode for production.")
  const server = createServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("Gmail MCP Server started (stdio)")
}

async function startHttpServer() {
  const app = express()

  // Parse JSON bodies
  app.use(express.json())

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "gmail" })
  })

  // Helper to extract and validate Bearer token
  function extractToken(req: express.Request): string | null {
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.slice(7)
    }
    return null
  }

  // REST API: Send email (user clicks Send button)
  app.post("/api/send", async (req, res) => {
    try {
      const accessToken = extractToken(req)
      if (!accessToken) {
        res.status(401).json({ success: false, error: "Missing Authorization header" })
        return
      }

      const { to, cc, bcc, subject, body, threadId: _threadId } = req.body
      if (!to || !subject || !body) {
        res.status(400).json({ success: false, error: "Missing required fields: to, subject, body" })
        return
      }

      const gmail = createGmailClient(accessToken)
      const { sendEmail } = await import("./gmail-client.js")

      const toList = Array.isArray(to) ? to.join(", ") : to
      const ccList = Array.isArray(cc) ? cc.join(", ") : cc
      const bccList = Array.isArray(bcc) ? bcc.join(", ") : bcc

      const result = await sendEmail(gmail, toList, subject, body, ccList, bccList)

      res.json({ success: true, messageId: result.id, threadId: result.threadId })
    } catch (error) {
      console.error("[Gmail API] Send error:", error)
      const message = error instanceof Error ? error.message : "Failed to send email"
      res.status(500).json({ success: false, error: message })
    }
  })

  // REST API: Save draft (user clicks Save Draft button)
  app.post("/api/draft", async (req, res) => {
    try {
      const accessToken = extractToken(req)
      if (!accessToken) {
        res.status(401).json({ success: false, error: "Missing Authorization header" })
        return
      }

      const { to, cc, subject, body, threadId: _threadIdDraft } = req.body
      if (!to || !subject || !body) {
        res.status(400).json({ success: false, error: "Missing required fields: to, subject, body" })
        return
      }

      const gmail = createGmailClient(accessToken)
      const { createDraft } = await import("./gmail-client.js")

      const toList = Array.isArray(to) ? to.join(", ") : to
      const ccList = Array.isArray(cc) ? cc.join(", ") : cc

      const result = await createDraft(gmail, toList, subject, body, ccList)

      res.json({ success: true, draftId: result.id, messageId: result.messageId })
    } catch (error) {
      console.error("[Gmail API] Draft error:", error)
      const message = error instanceof Error ? error.message : "Failed to save draft"
      res.status(500).json({ success: false, error: message })
    }
  })

  // MCP endpoint - extracts Bearer token from Authorization header
  app.post("/mcp", async (req, res) => {
    try {
      // Extract Bearer token from Authorization header
      const authHeader = req.headers.authorization
      let accessToken: string | undefined

      if (authHeader?.startsWith("Bearer ")) {
        accessToken = authHeader.slice(7)
      }

      if (!accessToken) {
        res.status(401).json({
          jsonrpc: "2.0",
          error: { code: -32600, message: "Missing Authorization: Bearer <token> header" },
          id: null,
        })
        return
      }

      const server = createServer(accessToken)
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      })

      res.on("close", () => {
        transport.close()
      })

      await server.connect(transport)
      await transport.handleRequest(req, res, req.body)
    } catch (error) {
      console.error("Error handling MCP request:", error)
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        })
      }
    }
  })

  // Catch-all 404
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" })
  })

  app.listen(PORT, () => {
    console.error(`Gmail MCP Server running on http://localhost:${PORT}/mcp`)
    console.error("Accepts Bearer token via Authorization header")
  })
}

async function main() {
  if (TRANSPORT_TYPE === "http") {
    await startHttpServer()
  } else {
    await startStdioServer()
  }
}

main().catch(error => {
  console.error("Failed to start server:", error)
  process.exit(1)
})
