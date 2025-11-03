import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { browserManager } from "../../lib/browser-manager.js"

/**
 * Console Log Structure
 */
interface ConsoleLog {
  type: "log" | "info" | "warn" | "error" | "debug"
  text: string
  timestamp: number
  args?: string[]
  location?: {
    url: string
    lineNumber?: number
    columnNumber?: number
  }
}

/**
 * Tool Parameters
 */
export const readConsoleLogsParamsSchema = {
  workspaceUrl: z.string().describe("URL of the deployed workspace (e.g., https://two.goalive.nl)"),
  search: z.string().optional().describe('Optional search term to filter logs (e.g., "error", "warning", "undefined")'),
  waitTime: z
    .number()
    .optional()
    .default(3000)
    .describe("Milliseconds to wait for page to load and collect logs (default: 3000ms)"),
}

export type ReadConsoleLogsParams = {
  workspaceUrl: string
  search?: string
  waitTime?: number
}

export type ReadConsoleLogsResult = {
  content: Array<{ type: "text"; text: string }>
  isError: boolean
}

/**
 * Business Logic: Read Console Logs from Browser
 */
export async function readConsoleLogs(params: ReadConsoleLogsParams): Promise<ReadConsoleLogsResult> {
  const { workspaceUrl, search, waitTime = 3000 } = params

  let context: Awaited<ReturnType<typeof browserManager.createContext>> | null = null

  try {
    // Validate URL
    const _url = new URL(workspaceUrl)

    // Create browser context
    context = await browserManager.createContext()
    const page = await context.newPage()

    const logs: ConsoleLog[] = []
    const errors: string[] = []

    // Capture console messages
    page.on("console", msg => {
      try {
        const log: ConsoleLog = {
          type: msg.type() as ConsoleLog["type"],
          text: msg.text(),
          timestamp: Date.now(),
          args: msg.args().map(arg => String(arg)),
          location: msg.location()
            ? {
                url: msg.location().url,
                lineNumber: msg.location().lineNumber,
                columnNumber: msg.location().columnNumber,
              }
            : undefined,
        }
        logs.push(log)
      } catch (err) {
        errors.push(`Failed to capture console message: ${err}`)
      }
    })

    // Capture page errors
    page.on("pageerror", error => {
      logs.push({
        type: "error",
        text: `PAGE ERROR: ${error.message}`,
        timestamp: Date.now(),
      })
    })

    // Navigate to the page
    console.log(`[read-console-logs] Navigating to ${workspaceUrl}`)
    await page.goto(workspaceUrl, {
      waitUntil: "networkidle",
      timeout: 30000,
    })

    // Wait for additional logs
    console.log(`[read-console-logs] Waiting ${waitTime}ms for logs...`)
    await page.waitForTimeout(waitTime)

    // Close the page and context
    await page.close()
    await context.close()
    context = null

    // Filter logs if search term provided
    let filteredLogs = logs
    if (search) {
      const searchLower = search.toLowerCase()
      filteredLogs = logs.filter(
        log =>
          log.text.toLowerCase().includes(searchLower) ||
          log.type.toLowerCase().includes(searchLower) ||
          log.args?.some(arg => arg.toLowerCase().includes(searchLower)),
      )
    }

    // Format output
    if (filteredLogs.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: search
              ? `No console logs found matching "${search}"`
              : "No console logs captured. The page may not have any console output.",
          },
        ],
        isError: false,
      }
    }

    // Group logs by type
    const logsByType = filteredLogs.reduce(
      (acc, log) => {
        if (!acc[log.type]) acc[log.type] = []
        acc[log.type].push(log)
        return acc
      },
      {} as Record<string, ConsoleLog[]>,
    )

    // Format logs for output
    let output = `# Console Logs from ${workspaceUrl}\n\n`
    output += `**Total logs captured:** ${logs.length}\n`
    if (search) {
      output += `**Filtered by:** "${search}"\n`
    }
    output += `**Matching logs:** ${filteredLogs.length}\n\n`

    // Summary by type
    output += "## Summary\n"
    for (const [type, typeLogs] of Object.entries(logsByType)) {
      output += `- **${type}:** ${typeLogs.length}\n`
    }
    output += "\n---\n\n"

    // Detailed logs
    output += "## Logs\n\n"
    for (const log of filteredLogs) {
      const timestamp = new Date(log.timestamp).toISOString()
      output += `### [${log.type.toUpperCase()}] ${timestamp}\n`
      output += `\`\`\`\n${log.text}\n\`\`\`\n`
      if (log.location) {
        output += `*Location: ${log.location.url}`
        if (log.location.lineNumber) {
          output += `:${log.location.lineNumber}`
        }
        if (log.location.columnNumber) {
          output += `:${log.location.columnNumber}`
        }
        output += "*\n"
      }
      output += "\n"
    }

    // Add any capture errors
    if (errors.length > 0) {
      output += "\n---\n\n## Capture Warnings\n\n"
      for (const error of errors) {
        output += `- ${error}\n`
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
          text: `# Failed to Read Console Logs\n\n**URL:** ${workspaceUrl}\n\n**Error:** ${errorMessage}\n\n**Troubleshooting:**\n- Verify the URL is accessible\n- Check if the site is deployed and running\n- Ensure the URL includes the protocol (https://)`,
        },
      ],
      isError: true,
    }
  }
}

/**
 * MCP Tool Registration
 */
export const readConsoleLogsTool = tool(
  "read_console_logs",
  "Captures browser console logs (console.log, console.error, console.warn, etc.) from a deployed website. Use this FIRST when debugging issues to see actual runtime errors and output.",
  readConsoleLogsParamsSchema,
  async args => {
    return readConsoleLogs(args)
  },
)
