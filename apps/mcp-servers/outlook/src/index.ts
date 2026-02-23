#!/usr/bin/env bun
/**
 * Outlook MCP Server
 *
 * MCP-only server for Outlook email functionality via Microsoft Graph.
 * Accepts Bearer tokens via HTTP Authorization header.
 *
 * REST endpoints (send, draft) are handled by Next.js API routes,
 * not this server. This keeps concerns separated:
 * - MCP server: Claude tool calls
 * - Next.js API: User UI actions (Send/Save Draft buttons)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import type { CallToolRequest } from "@modelcontextprotocol/sdk/types.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { Command } from "commander"
import type { Request, Response } from "express"
import express from "express"
import { OutlookClient } from "./outlook-client.js"
import { executeTool, tools } from "./tools/index.js"

const defaultPort = 8088

// Parse CLI arguments
const program = new Command()
  .option("--transport <stdio|http>", "transport type", "http")
  .option("--port <number>", "port for HTTP transport", defaultPort.toString())
  .allowUnknownOption()
  .parse(process.argv)

const cliOptions = program.opts<{ transport: string; port: string }>()

// Validate transport option
const isValidTransport = (value: string): value is "stdio" | "http" => value === "stdio" || value === "http"

if (!isValidTransport(cliOptions.transport)) {
  console.error(`Invalid --transport value: '${cliOptions.transport}'. Must be one of: stdio, http.`)
  process.exit(1)
}

const transportType = cliOptions.transport
const port = Number.parseInt(cliOptions.port, 10)
if (Number.isNaN(port)) {
  throw new Error(`Invalid --port value: '${cliOptions.port}'`)
}

/**
 * Create MCP server with Outlook client injected
 */
function createServer(accessToken?: string) {
  const server = new Server(
    {
      name: "outlook",
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
  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params

    if (!accessToken) {
      return {
        content: [
          { type: "text", text: "Error: No access token provided. Include Authorization: Bearer <token> header." },
        ],
        isError: true,
      }
    }

    const client = new OutlookClient(accessToken)
    return await executeTool(client, name, args || {})
  })

  return server
}

async function startStdioServer() {
  console.error("Warning: stdio mode does not support authentication. Use HTTP mode for production.")
  const server = createServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("Outlook MCP Server started (stdio)")
}

async function startHttpServer() {
  const app = express()

  // Parse JSON bodies
  app.use(express.json())

  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", server: "outlook" })
  })

  // MCP endpoint — extracts Bearer token from Authorization header
  app.post("/mcp", async (req: Request, res: Response) => {
    try {
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
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" })
  })

  app.listen(port, () => {
    console.error(`Outlook MCP Server running on http://localhost:${port}/mcp`)
    console.error("Accepts Bearer token via Authorization header")
  })
}

async function main() {
  if (transportType === "http") {
    await startHttpServer()
  } else {
    await startStdioServer()
  }
}

main().catch(error => {
  console.error("Failed to start server:", error)
  process.exit(1)
})
