import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { browserManager } from "../../lib/browser-manager.js"

/**
 * Network Request Structure
 */
interface NetworkRequest {
  url: string
  method: string
  resourceType: string
  status?: number
  statusText?: string
  headers: Record<string, string>
  timing: {
    startTime: number
    endTime?: number
    duration?: number
  }
  request: {
    headers: Record<string, string>
    postData?: string
  }
  response?: {
    headers: Record<string, string>
    body?: string
    size: number
  }
  failed?: boolean
  failureText?: string
}

/**
 * Tool Parameters
 */
export const readNetworkRequestsParamsSchema = {
  workspaceUrl: z.string().describe("URL of the deployed workspace (e.g., https://two.goalive.nl)"),
  search: z.string().optional().describe('Optional search term to filter requests (e.g., "api", "error", "/users")'),
  waitTime: z
    .number()
    .optional()
    .default(3000)
    .describe("Milliseconds to wait for page to load and collect network activity (default: 3000ms)"),
}

export type ReadNetworkRequestsParams = {
  workspaceUrl: string
  search?: string
  waitTime?: number
}

export type ReadNetworkRequestsResult = {
  content: Array<{ type: "text"; text: string }>
  isError: boolean
}

/**
 * Business Logic: Read Network Requests from Browser
 */
export async function readNetworkRequests(params: ReadNetworkRequestsParams): Promise<ReadNetworkRequestsResult> {
  const { workspaceUrl, search, waitTime = 3000 } = params

  let context: Awaited<ReturnType<typeof browserManager.createContext>> | null = null

  try {
    // Validate URL
    const _url = new URL(workspaceUrl)

    // Create browser context
    context = await browserManager.createContext()
    const page = await context.newPage()

    const requests: NetworkRequest[] = []
    const requestMap = new Map<string, NetworkRequest>()

    // Capture requests
    page.on("request", request => {
      const req: NetworkRequest = {
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        headers: request.headers(),
        timing: {
          startTime: Date.now(),
        },
        request: {
          headers: request.headers(),
          postData: request.postData() || undefined,
        },
      }
      requestMap.set(request.url(), req)
      requests.push(req)
    })

    // Capture responses
    page.on("response", async response => {
      const req = requestMap.get(response.url())
      if (req) {
        req.status = response.status()
        req.statusText = response.statusText()
        req.timing.endTime = Date.now()
        req.timing.duration = req.timing.endTime - req.timing.startTime

        try {
          const responseHeaders = response.headers()
          const contentType = responseHeaders["content-type"] || ""

          req.response = {
            headers: responseHeaders,
            size: Number.parseInt(responseHeaders["content-length"] || "0", 10),
            body: undefined, // Don't capture body by default for performance
          }

          // Only capture response body for JSON/text responses with errors
          if (response.status() >= 400 && (contentType.includes("json") || contentType.includes("text"))) {
            try {
              req.response.body = await response.text()
            } catch {
              // Ignore body capture errors
            }
          }
        } catch (_error) {
          // Ignore response processing errors
        }
      }
    })

    // Capture failed requests
    page.on("requestfailed", request => {
      const req = requestMap.get(request.url())
      if (req) {
        req.failed = true
        req.failureText = request.failure()?.errorText || "Unknown failure"
        req.timing.endTime = Date.now()
        req.timing.duration = req.timing.endTime - req.timing.startTime
      }
    })

    // Navigate to the page
    console.log(`[read-network-requests] Navigating to ${workspaceUrl}`)
    await page.goto(workspaceUrl, {
      waitUntil: "networkidle",
      timeout: 30000,
    })

    // Wait for additional network activity
    console.log(`[read-network-requests] Waiting ${waitTime}ms for network activity...`)
    await page.waitForTimeout(waitTime)

    // Close the page and context
    await page.close()
    await context.close()
    context = null

    // Filter requests if search term provided
    let filteredRequests = requests
    if (search) {
      const searchLower = search.toLowerCase()
      filteredRequests = requests.filter(
        req =>
          req.url.toLowerCase().includes(searchLower) ||
          req.method.toLowerCase().includes(searchLower) ||
          req.resourceType.toLowerCase().includes(searchLower) ||
          req.statusText?.toLowerCase().includes(searchLower) ||
          (req.status && String(req.status).includes(search)),
      )
    }

    // Format output
    if (filteredRequests.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: search
              ? `No network requests found matching "${search}"`
              : "No network requests captured. The page may not have made any requests.",
          },
        ],
        isError: false,
      }
    }

    // Categorize requests
    const failedRequests = filteredRequests.filter(r => r.failed)
    const errorRequests = filteredRequests.filter(r => r.status && r.status >= 400 && !r.failed)
    const successRequests = filteredRequests.filter(r => r.status && r.status < 400)

    // Format output
    let output = `# Network Requests from ${workspaceUrl}\n\n`
    output += `**Total requests:** ${requests.length}\n`
    if (search) {
      output += `**Filtered by:** "${search}"\n`
    }
    output += `**Matching requests:** ${filteredRequests.length}\n\n`

    // Summary
    output += "## Summary\n"
    output += `- **Failed:** ${failedRequests.length}\n`
    output += `- **Errors (4xx/5xx):** ${errorRequests.length}\n`
    output += `- **Successful:** ${successRequests.length}\n\n`

    // Failed requests (most important)
    if (failedRequests.length > 0) {
      output += "## ❌ Failed Requests\n\n"
      for (const req of failedRequests) {
        output += `### ${req.method} ${req.url}\n`
        output += `- **Failure:** ${req.failureText}\n`
        output += `- **Resource Type:** ${req.resourceType}\n`
        output += `- **Duration:** ${req.timing.duration}ms\n\n`
      }
    }

    // Error responses
    if (errorRequests.length > 0) {
      output += "## ⚠️ Error Responses (4xx/5xx)\n\n"
      for (const req of errorRequests) {
        output += `### ${req.method} ${req.url}\n`
        output += `- **Status:** ${req.status} ${req.statusText}\n`
        output += `- **Resource Type:** ${req.resourceType}\n`
        output += `- **Duration:** ${req.timing.duration}ms\n`
        if (req.response?.body) {
          output += `- **Response Body:**\n\`\`\`json\n${req.response.body}\n\`\`\`\n`
        }
        output += "\n"
      }
    }

    // Successful requests (less detail)
    if (successRequests.length > 0 && !search) {
      output += `## ✅ Successful Requests (${successRequests.length} total)\n\n`
      // Group by resource type
      const byType = successRequests.reduce(
        (acc, req) => {
          if (!acc[req.resourceType]) acc[req.resourceType] = []
          acc[req.resourceType].push(req)
          return acc
        },
        {} as Record<string, NetworkRequest[]>,
      )

      for (const [type, reqs] of Object.entries(byType)) {
        output += `### ${type} (${reqs.length})\n`
        for (const req of reqs.slice(0, 5)) {
          // Show first 5 of each type
          output += `- ${req.method} ${req.url} - ${req.status} (${req.timing.duration}ms)\n`
        }
        if (reqs.length > 5) {
          output += `- ... and ${reqs.length - 5} more\n`
        }
        output += "\n"
      }
    } else if (successRequests.length > 0 && search) {
      // Show all matching successful requests when filtering
      output += "## ✅ Successful Requests\n\n"
      for (const req of successRequests) {
        output += `### ${req.method} ${req.url}\n`
        output += `- **Status:** ${req.status} ${req.statusText}\n`
        output += `- **Resource Type:** ${req.resourceType}\n`
        output += `- **Duration:** ${req.timing.duration}ms\n\n`
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: output,
        },
      ],
      isError: false,
    }
  } catch (error) {
    // Clean up context if still open
    if (context) {
      try {
        await context.close()
      } catch {}
    }

    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      content: [
        {
          type: "text" as const,
          text: `# Failed to Read Network Requests\n\n**URL:** ${workspaceUrl}\n\n**Error:** ${errorMessage}\n\n**Troubleshooting:**\n- Verify the URL is accessible\n- Check if the site is deployed and running\n- Ensure the URL includes the protocol (https://)`,
        },
      ],
      isError: true,
    }
  }
}

/**
 * MCP Tool Registration
 */
export const readNetworkRequestsTool = tool(
  "read_network_requests",
  "Captures all network requests (fetch, XHR, resource loads) from a deployed website. Shows request/response details, status codes, timing, and failures. Use this when debugging API calls or network issues.",
  readNetworkRequestsParamsSchema,
  async args => {
    return readNetworkRequests(args)
  },
)
