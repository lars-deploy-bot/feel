#!/usr/bin/env node
/**
 * Google Search Console MCP Server
 *
 * Accepts Google OAuth Bearer tokens via HTTP Authorization header.
 * Port 8089, same pattern as Gmail (8085), Calendar (8087), Outlook (8088).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { Command } from "commander"
import express from "express"
import { executeTool, tools } from "./tools/index.js"

const DEFAULT_PORT = 8089

const program = new Command()
  .option("--transport <stdio|http>", "transport type", "http")
  .option("--port <number>", "port for HTTP transport", DEFAULT_PORT.toString())
  .allowUnknownOption()
  .parse(process.argv)

const cliOptions = program.opts()

if (cliOptions.transport !== "stdio" && cliOptions.transport !== "http") {
  console.error(`Invalid --transport value: '${cliOptions.transport}'. Must be: stdio or http.`)
  process.exit(1)
}

const TRANSPORT_TYPE: "stdio" | "http" = cliOptions.transport
const PORT = parseInt(cliOptions.port, 10) || DEFAULT_PORT

function createServer(accessToken?: string) {
  const server = new Server({ name: "google_search_console", version: "1.0.0" }, { capabilities: { tools: {} } })

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: args } = request.params

    if (!accessToken) {
      return {
        content: [{ type: "text", text: "Error: No access token. Include Authorization: Bearer <token> header." }],
        isError: true,
      }
    }

    return executeTool(accessToken, name, args ?? {})
  })

  return server
}

async function startStdioServer() {
  console.error("Warning: stdio mode does not support authentication. Use HTTP mode for production.")
  const server = createServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("Google Search Console MCP Server started (stdio)")
}

async function startHttpServer() {
  const app = express()
  app.use(express.json())

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "google-search-console" })
  })

  app.post("/mcp", async (req, res) => {
    try {
      const authHeader = req.headers.authorization
      const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined

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

      res.on("close", () => transport.close())

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

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" })
  })

  app.listen(PORT, () => {
    console.error(`Google Search Console MCP Server running on http://localhost:${PORT}/mcp`)
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
