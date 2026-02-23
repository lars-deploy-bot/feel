/**
 * Browser Tool
 *
 * Allows the agent to control a headless browser for website QA.
 * Communicates with the browser-control service at localhost:5061.
 *
 * The tool extracts the workspace domain from process.cwd() and sends
 * it to the browser-control service, which resolves it to localhost:port
 * via the port-map.json file.
 */

import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { errorResult, type ToolResult } from "../../lib/api-client.js"
import { extractDomainFromWorkspace, validateWorkspacePath } from "../../lib/workspace-validator.js"

const BROWSER_CONTROL_URL = "http://127.0.0.1:5061"
const REQUEST_TIMEOUT_MS = 60_000

const browserActions = z.enum(["open", "screenshot", "snapshot", "click", "fill", "type", "console", "status"])

export const browserParamsSchema = {
  action: browserActions.describe("Browser action to perform"),
  path: z.string().optional().describe("URL path to navigate to (e.g., '/about'). Used with 'open' action."),
  ref: z.string().optional().describe("Element ref from snapshot (e.g., 'e12'). Used with 'click' and 'fill'."),
  value: z.string().optional().describe("Value to fill into an input. Used with 'fill' action."),
  text: z.string().optional().describe("Text to type via keyboard. Used with 'type' action."),
  fullPage: z
    .boolean()
    .optional()
    .describe("Capture full page screenshot (default: true). Used with 'screenshot' action."),
  interactive: z
    .boolean()
    .optional()
    .describe("Only show interactive elements in snapshot (default: false). Used with 'snapshot' action."),
  clear: z.boolean().optional().describe("Clear console buffer after reading. Used with 'console' action."),
}

export type BrowserParams = {
  action: z.infer<typeof browserActions>
  path?: string
  ref?: string
  value?: string
  text?: string
  fullPage?: boolean
  interactive?: boolean
  clear?: boolean
}

async function callBrowserService(
  endpoint: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const internalSecret = process.env.INTERNAL_TOOLS_SECRET

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${BROWSER_CONTROL_URL}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(internalSecret ? { "X-Internal-Secret": internalSecret } : {}),
      },
      body: method === "POST" ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const data = (await response.json()) as Record<string, unknown>
    return { ok: response.ok, status: response.status, data }
  } catch (err) {
    clearTimeout(timeoutId)
    const message = err instanceof Error ? err.message : String(err)

    if (message.includes("aborted")) {
      throw new Error("Browser request timed out after 60s")
    }
    if (message.includes("ECONNREFUSED")) {
      throw new Error(
        "Browser control service is not running. It needs to be started as a systemd service (browser-control.service).",
      )
    }
    throw err
  }
}

export async function browserAction(params: BrowserParams): Promise<ToolResult> {
  const workspaceRoot = process.cwd()

  try {
    validateWorkspacePath(workspaceRoot)
  } catch (error) {
    return errorResult("Invalid workspace", error instanceof Error ? error.message : String(error))
  }

  let domain: string
  try {
    domain = extractDomainFromWorkspace(workspaceRoot)
  } catch (error) {
    return errorResult("Could not determine site domain", error instanceof Error ? error.message : String(error))
  }

  try {
    switch (params.action) {
      case "status": {
        const { data } = await callBrowserService(`/status/${domain}`, "GET")
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          isError: false,
        }
      }

      case "open": {
        const { ok, data } = await callBrowserService("/open", "POST", {
          domain,
          path: params.path ?? "/",
        })
        if (!ok) {
          return errorResult("Failed to open page", String(data.error))
        }
        return {
          content: [
            {
              type: "text",
              text: `Opened ${data.url}\nTitle: ${data.title}\nStatus: ${data.status}`,
            },
          ],
          isError: false,
        }
      }

      case "screenshot": {
        const { ok, data } = await callBrowserService("/screenshot", "POST", {
          domain,
          fullPage: params.fullPage ?? true,
        })
        if (!ok) {
          return errorResult("Screenshot failed", String(data.error))
        }
        return {
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: data.image as string,
              },
            } as unknown as { type: "text"; text: string },
            {
              type: "text",
              text: `Screenshot of ${data.url} (${data.title})`,
            },
          ],
          isError: false,
        }
      }

      case "snapshot": {
        const { ok, data } = await callBrowserService("/snapshot", "POST", {
          domain,
          interactive: params.interactive ?? false,
        })
        if (!ok) {
          return errorResult("Snapshot failed", String(data.error))
        }

        const stats = data.stats as { refs: number; interactive: number; lines: number; chars: number } | undefined
        const refCount = stats?.interactive ?? stats?.refs ?? 0
        const header = `Page: ${data.url} | Title: ${data.title} | Interactive elements: ${refCount}`
        const refHelp = refCount > 0 ? "\n\nUse refs (e.g., click ref=e1) to interact with elements." : ""

        return {
          content: [
            {
              type: "text",
              text: `${header}\n\n${data.tree}${refHelp}`,
            },
          ],
          isError: false,
        }
      }

      case "click":
      case "fill":
      case "type": {
        const { ok, data } = await callBrowserService("/act", "POST", {
          domain,
          action: params.action,
          ref: params.ref,
          value: params.value,
          text: params.text,
        })
        if (!ok) {
          return errorResult("Action failed", String(data.error))
        }
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          isError: false,
        }
      }

      case "console": {
        const { ok, data } = await callBrowserService("/console", "POST", {
          domain,
          clear: params.clear ?? false,
        })
        if (!ok) {
          return errorResult("Console read failed", String(data.error))
        }

        const messages = data.consoleMessages as Array<{ type: string; text: string; timestamp: string }>
        const errors = data.pageErrors as Array<{ message: string; timestamp: string }>

        const parts: string[] = []

        if (errors.length > 0) {
          parts.push(`--- Page Errors (${errors.length}) ---`)
          for (const err of errors) {
            parts.push(`[${err.timestamp}] ${err.message}`)
          }
        }

        if (messages.length > 0) {
          parts.push(`--- Console Messages (${messages.length}) ---`)
          for (const msg of messages) {
            parts.push(`[${msg.timestamp}] [${msg.type}] ${msg.text}`)
          }
        }

        if (parts.length === 0) {
          parts.push("No console messages or errors.")
        }

        return {
          content: [{ type: "text", text: parts.join("\n") }],
          isError: false,
        }
      }

      default:
        return errorResult("Unknown action", `"${params.action}" is not a valid browser action`)
    }
  } catch (error) {
    return errorResult("Browser error", error instanceof Error ? error.message : String(error))
  }
}

export const browserTool = tool(
  "browser",
  `Control a headless browser to QA the website you're building. Opens the site on localhost and lets you inspect and interact with it.

**Actions:**
- **open**: Navigate to a page. Params: path (e.g., "/about"). Always call this first.
- **screenshot**: Take a screenshot of the current page. Params: fullPage (default: true).
- **snapshot**: Get the accessibility tree with element refs (e1, e2, ...). Params: interactive (only show clickable elements).
- **click**: Click an element by ref from snapshot. Params: ref (e.g., "e3").
- **fill**: Fill an input field by ref. Params: ref, value.
- **type**: Type text via keyboard. Params: text.
- **console**: Read JavaScript console logs and errors. Params: clear (reset buffer).
- **status**: Check browser status for this workspace.

**Workflow:** open -> snapshot -> (click/fill/type) -> screenshot to verify.
**Refs:** After snapshot, use the ref IDs (e1, e2, ...) to target elements for click/fill.`,
  browserParamsSchema,
  async args => {
    return browserAction(args as BrowserParams)
  },
)
