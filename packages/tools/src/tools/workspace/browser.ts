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
import { retryAsync } from "@webalive/shared"
import { z } from "zod"
import { errorResult, type ToolResult } from "../../lib/api-client.js"
import { extractDomainFromWorkspace, validateWorkspacePath } from "../../lib/workspace-validator.js"

const BROWSER_CONTROL_URL = "http://127.0.0.1:5061"
const REQUEST_TIMEOUT_MS = 90_000

/** Unique per worker process — isolates browser sessions between parallel chats. */
const SESSION_ID = `worker-${process.pid}`

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

type BrowserParams = z.infer<z.ZodObject<typeof browserParamsSchema>>

async function callBrowserService(
  endpoint: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>,
  cancelSignal?: AbortSignal,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const internalSecret = process.env.INTERNAL_TOOLS_SECRET
  if (!internalSecret) {
    throw new Error("INTERNAL_TOOLS_SECRET is required to call browser-control")
  }

  return retryAsync(
    async () => {
      // Combine timeout + external cancel signal: abort on whichever fires first
      const controller = new AbortController()
      if (cancelSignal?.aborted) {
        throw new Error("Browser request cancelled")
      }
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      const onCancel = () => controller.abort()
      cancelSignal?.addEventListener("abort", onCancel, { once: true })

      try {
        const response = await fetch(`${BROWSER_CONTROL_URL}${endpoint}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Secret": internalSecret,
          },
          body: method === "POST" ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)
        cancelSignal?.removeEventListener("abort", onCancel)

        const data: unknown = await response.json()
        if (typeof data !== "object" || data === null || Array.isArray(data)) {
          throw new Error("Unexpected response format from browser-control service")
        }
        return { ok: response.ok, status: response.status, data: data as Record<string, unknown> }
      } catch (err) {
        clearTimeout(timeoutId)
        cancelSignal?.removeEventListener("abort", onCancel)
        const message = err instanceof Error ? err.message : String(err)

        if (message.includes("aborted")) {
          // Distinguish user cancel from timeout
          if (cancelSignal?.aborted) {
            throw new Error("Browser request cancelled")
          }
          throw new Error("Browser request timed out after 90s")
        }
        // Bun uses "Unable to connect", Node uses "ECONNREFUSED", etc.
        if (
          message.includes("ECONNREFUSED") ||
          message.includes("Unable to connect") ||
          message.includes("ConnectionRefused") ||
          message.includes("fetch failed")
        ) {
          throw new Error(
            "Browser control service is not running. Enable it in alive.toml [services.browser-control] and start the container in alive-services.",
          )
        }
        throw err
      }
    },
    {
      attempts: 3,
      minDelayMs: 500,
      shouldRetry: err => {
        const message = err instanceof Error ? err.message : String(err)
        // Don't retry timeouts, cancellations, connection refused, or auth errors
        if (message.includes("timed out") || message.includes("cancelled") || message.includes("not running"))
          return false
        // Retry transient network errors
        return true
      },
    },
  )
}

export async function browserAction(params: BrowserParams, cancelSignal?: AbortSignal): Promise<ToolResult> {
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
        const { ok, data } = await callBrowserService(`/status/${domain}`, "GET", undefined, cancelSignal)
        if (!ok) {
          return errorResult("Status check failed", String(data.error))
        }
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          isError: false,
        }
      }

      case "open": {
        const { ok, data } = await callBrowserService(
          "/open",
          "POST",
          {
            domain,
            sessionId: SESSION_ID,
            path: params.path ?? "/",
          },
          cancelSignal,
        )
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
        const { ok, data } = await callBrowserService(
          "/screenshot",
          "POST",
          {
            domain,
            sessionId: SESSION_ID,
            fullPage: params.fullPage ?? true,
          },
          cancelSignal,
        )
        if (!ok) {
          return errorResult("Screenshot failed", String(data.error))
        }
        if (typeof data.image !== "string") {
          return errorResult("Screenshot failed", "Missing image data from browser-control service")
        }
        return {
          content: [
            {
              type: "image",
              data: data.image,
              mimeType: "image/png",
            },
            {
              type: "text",
              text: `Screenshot of ${data.url} (${data.title})`,
            },
          ],
          isError: false,
        }
      }

      case "snapshot": {
        const { ok, data } = await callBrowserService(
          "/snapshot",
          "POST",
          {
            domain,
            sessionId: SESSION_ID,
            interactive: params.interactive ?? false,
          },
          cancelSignal,
        )
        if (!ok) {
          return errorResult("Snapshot failed", String(data.error))
        }

        const stats =
          typeof data.stats === "object" && data.stats !== null ? (data.stats as Record<string, unknown>) : {}
        const refCount =
          typeof stats.interactive === "number" ? stats.interactive : typeof stats.refs === "number" ? stats.refs : 0
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
        const { ok, data } = await callBrowserService(
          "/act",
          "POST",
          {
            domain,
            sessionId: SESSION_ID,
            action: params.action,
            ref: params.ref,
            value: params.value,
            text: params.text,
          },
          cancelSignal,
        )
        if (!ok) {
          return errorResult("Action failed", String(data.error))
        }
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          isError: false,
        }
      }

      case "console": {
        const { ok, data } = await callBrowserService(
          "/console",
          "POST",
          {
            domain,
            sessionId: SESSION_ID,
            clear: params.clear ?? false,
          },
          cancelSignal,
        )
        if (!ok) {
          return errorResult("Console read failed", String(data.error))
        }

        const messages = Array.isArray(data.consoleMessages) ? data.consoleMessages : []
        const errors = Array.isArray(data.pageErrors) ? data.pageErrors : []

        const parts: string[] = []

        if (errors.length > 0) {
          parts.push(`--- Page Errors (${errors.length}) ---`)
          for (const err of errors) {
            if (typeof err === "object" && err !== null) {
              parts.push(
                `[${String((err as Record<string, unknown>).timestamp)}] ${String((err as Record<string, unknown>).message)}`,
              )
            }
          }
        }

        if (messages.length > 0) {
          parts.push(`--- Console Messages (${messages.length}) ---`)
          for (const msg of messages) {
            if (typeof msg === "object" && msg !== null) {
              const m = msg as Record<string, unknown>
              parts.push(`[${String(m.timestamp)}] [${String(m.type)}] ${String(m.text)}`)
            }
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
  async (args, extra) => {
    const signal =
      extra && typeof extra === "object" && "signal" in extra && extra.signal instanceof AbortSignal
        ? extra.signal
        : undefined
    return browserAction(args, signal)
  },
)
