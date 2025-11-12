import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { callBridgeApi } from "../../lib/bridge-api-client.js"

interface ServerLog {
  timestamp: string
  level: string
  message: string
  service: string
}

export const readServerLogsParamsSchema = {
  workspace: z
    .string()
    .min(1)
    .regex(/^[a-z0-9.-]+$/i, "Workspace must be a valid domain (e.g., two.goalive.nl)")
    .describe("Workspace domain (e.g., 'two.goalive.nl')"),
  search: z.string().optional().describe('Filter logs by search term (e.g., "error", "warning", "vite")'),
  search_regex: z
    .string()
    .optional()
    .describe(
      'Advanced: Filter logs using regex pattern (e.g., "error|warn", "failed.*build", "\\d{3}\\s*error"). More powerful than basic search.',
    ),
  lines: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .default(100)
    .describe("Number of log lines to retrieve (default: 100, max: 1000)"),
  since: z.string().optional().describe('Time range (e.g., "5 minutes ago", "1 hour ago", "today")'),
  summary_only: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Return only summary statistics without full log content (context-efficient). Shows error/warning counts and recent error samples.",
    ),
}

export type ReadServerLogsParams = {
  workspace: string
  search?: string
  search_regex?: string
  lines?: number
  since?: string
  summary_only?: boolean
}

export type ReadServerLogsResult = {
  content: Array<{ type: "text"; text: string }>
  isError: boolean
}

function sanitizeSearchTerm(search: string): string {
  return search.replace(/[;&|`$()<>]/g, "")
}

function parseJournalctlOutput(output: string): ServerLog[] {
  const lines = output.trim().split("\n").filter(Boolean)
  const logs: ServerLog[] = []

  for (const line of lines) {
    const match = line.match(/^(\S+\s+\S+)\s+\S+\s+(\S+)\[.*?\]:\s*(.+)$/)
    if (match) {
      logs.push({
        timestamp: match[1],
        service: match[2],
        level: detectLogLevel(match[3]),
        message: match[3].trim(),
      })
    } else {
      logs.push({
        timestamp: "",
        service: "",
        level: "info",
        message: line.trim(),
      })
    }
  }

  return logs
}

function detectLogLevel(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes("error") || lower.includes("✘") || lower.includes("failed") || lower.includes("exception")) {
    return "error"
  }
  if (lower.includes("warn") || lower.includes("⚠")) {
    return "warn"
  }
  if (lower.includes("✓") || lower.includes("success") || lower.includes("built in")) {
    return "success"
  }
  return "info"
}

export async function readServerLogs(params: ReadServerLogsParams): Promise<ReadServerLogsResult> {
  const { workspace, search, search_regex, lines = 100, since, summary_only = false } = params

  try {
    // Call Bridge API to read logs (runs as root with proper privileges)
    const apiResult = await callBridgeApi({
      endpoint: "/api/internal-tools/read-logs",
      body: {
        workspace,
        lines,
        since,
        workspaceRoot: process.cwd(), // Required for auth validation
      },
      timeout: 15000,
    })

    // If API call failed, return the error
    if (apiResult.isError) {
      return apiResult
    }

    // Parse API response (output field contains JSON string with logs data)
    const apiResponse = JSON.parse(apiResult.content[0].text)
    const { logs: stdout, service: serviceName, status: serviceStatus } = apiResponse

    if (!stdout || stdout.trim() === "") {
      return {
        content: [
          {
            type: "text" as const,
            text: `# No Logs Available\n\n**Workspace:** ${workspace}\n**Service:** ${serviceName}\n**Status:** ${serviceStatus}\n\nThe service exists but has no logs yet.\n\n**Possible reasons:**\n- Service just started\n- Service hasn't generated any output\n- Logs may have been rotated\n\n**Try:**\n- Use a longer time range: \`since: "1 hour ago"\`\n- Check service status: \`systemctl status ${serviceName}\``,
          },
        ],
        isError: false,
      }
    }

    let logs = parseJournalctlOutput(stdout)

    // Apply filtering
    if (search_regex) {
      // Regex filtering (more powerful)
      try {
        const regex = new RegExp(search_regex, "i")
        const originalCount = logs.length
        logs = logs.filter(log => regex.test(log.message) || regex.test(log.level) || regex.test(log.service))
        console.log(`[read-server-logs] Regex filtered from ${originalCount} to ${logs.length} logs`)
      } catch (_regexError) {
        console.warn(`[read-server-logs] Invalid regex pattern: ${search_regex}, ignoring`)
      }
    } else if (search) {
      // Basic search (backwards compatible)
      const searchLower = sanitizeSearchTerm(search).toLowerCase()
      const originalCount = logs.length
      logs = logs.filter(
        log =>
          log.message.toLowerCase().includes(searchLower) ||
          log.level.toLowerCase().includes(searchLower) ||
          log.service.toLowerCase().includes(searchLower),
      )
      console.log(`[read-server-logs] Filtered from ${originalCount} to ${logs.length} logs`)
    }

    if (logs.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text:
              search || search_regex
                ? `# No Matching Logs\n\n**Workspace:** ${workspace}\n**${search_regex ? `Regex pattern: \`${search_regex}\`` : `Search: "${search}"`}\n**Total logs scanned:** ${parseJournalctlOutput(stdout).length}\n\nNo logs matched your ${search_regex ? "regex pattern" : "search term"}.\n\n**Try:**\n- Different ${search_regex ? "regex pattern" : "search term"}\n- Remove the search filter\n- Expand time range with \`since\` parameter`
                : `# No Logs\n\n**Workspace:** ${workspace}\n\nNo logs found in the specified time range.`,
          },
        ],
        isError: false,
      }
    }

    const byLevel: Record<string, ServerLog[]> = {}
    for (const log of logs) {
      if (!byLevel[log.level]) byLevel[log.level] = []
      byLevel[log.level].push(log)
    }

    let output = `# Server Logs: ${workspace}\n\n`
    output += `**Service:** ${serviceName}\n`
    output += `**Status:** ${serviceStatus}\n`
    output += `**Total logs:** ${logs.length}\n`
    if (search_regex) {
      output += `**Filtered by regex:** \`${search_regex}\`\n`
    } else if (search) {
      output += `**Filtered by:** "${search}"\n`
    }
    if (since) {
      output += `**Time range:** ${since}\n`
    }
    output += "\n"

    // Result hints: suggest next actions
    const resultHints: string[] = []
    if (logs.length > 0) {
      const errorCount = logs.filter(l => l.level === "error").length
      const warnCount = logs.filter(l => l.level === "warn").length

      if (errorCount > 10) {
        resultHints.push(
          "**High error count detected** - Consider restarting: `mcp__workspace-management__restart_dev_server`",
        )
      }
      if (errorCount > 0 || warnCount > 0) {
        resultHints.push(
          `**Use debug_workspace for automated analysis:** \`mcp__tools__debug_workspace({ workspace: "${workspace}" })\``,
        )
      }
      if (summary_only) {
        resultHints.push("**Viewing summary only** - Use `summary_only: false` for full logs")
      }
    }

    if (resultHints.length > 0) {
      output += "### Quick Suggestions\n"
      for (const hint of resultHints) {
        output += `- ${hint}\n`
      }
      output += "\n"
    }

    output += "## Summary\n"
    const errorCount = byLevel.error?.length || 0
    const warnCount = byLevel.warn?.length || 0
    const successCount = byLevel.success?.length || 0
    const infoCount = byLevel.info?.length || 0

    if (errorCount > 0) output += `- **Errors:** ${errorCount} ❌\n`
    if (warnCount > 0) output += `- **Warnings:** ${warnCount} ⚠️\n`
    if (successCount > 0) output += `- **Success:** ${successCount} ✓\n`
    if (infoCount > 0) output += `- **Info:** ${infoCount}\n`
    output += "\n"

    // Context-efficient mode: return only summary + sample errors
    if (summary_only) {
      output += "---\n\n"
      output += "*Summary mode enabled (context-efficient)*\n\n"

      if (errorCount > 0) {
        output += `## Sample Errors (${Math.min(3, errorCount)} of ${errorCount})\n\n`
        for (const log of byLevel.error.slice(0, 3)) {
          output += `**${log.timestamp || "Unknown time"}**\n`
          output += `\`\`\`\n${log.message.slice(0, 300)}${log.message.length > 300 ? "..." : ""}\n\`\`\`\n\n`
        }
      }

      if (warnCount > 0 && errorCount === 0) {
        output += `## Sample Warnings (${Math.min(3, warnCount)} of ${warnCount})\n\n`
        for (const log of byLevel.warn.slice(0, 3)) {
          output += `**${log.timestamp || "Unknown time"}**\n`
          output += `\`\`\`\n${log.message.slice(0, 300)}${log.message.length > 300 ? "..." : ""}\n\`\`\`\n\n`
        }
      }

      output += "\n**To see full logs**, call again with `summary_only: false`\n"

      return {
        content: [
          {
            type: "text" as const,
            text: output,
          },
        ],
        isError: false,
      }
    }

    // Full mode: return all logs
    output += "---\n\n"

    if (byLevel.error && byLevel.error.length > 0) {
      output += `## ❌ Errors (${byLevel.error.length})\n\n`
      for (const log of byLevel.error.slice(0, 20)) {
        output += `**${log.timestamp || "Unknown time"}**\n`
        output += `\`\`\`\n${log.message}\n\`\`\`\n\n`
      }
      if (byLevel.error.length > 20) {
        output += `... and ${byLevel.error.length - 20} more errors\n\n`
      }
    }

    if (byLevel.warn && byLevel.warn.length > 0) {
      output += `## ⚠️ Warnings (${byLevel.warn.length})\n\n`
      for (const log of byLevel.warn.slice(0, 10)) {
        output += `**${log.timestamp || "Unknown time"}**\n`
        output += `\`\`\`\n${log.message}\n\`\`\`\n\n`
      }
      if (byLevel.warn.length > 10) {
        output += `... and ${byLevel.warn.length - 10} more warnings\n\n`
      }
    }

    if (byLevel.success && byLevel.success.length > 0) {
      output += `## ✓ Success Messages (${byLevel.success.length})\n\n`
      for (const log of byLevel.success.slice(0, 5)) {
        output += `- ${log.message}\n`
      }
      if (byLevel.success.length > 5) {
        output += `- ... and ${byLevel.success.length - 5} more\n`
      }
      output += "\n"
    }

    if (!byLevel.error && !byLevel.warn && byLevel.info && byLevel.info.length > 0) {
      output += `## ℹ️ Info Logs (${byLevel.info.length})\n\n`
      for (const log of byLevel.info.slice(0, 10)) {
        output += `- ${log.message}\n`
      }
      if (byLevel.info.length > 10) {
        output += `- ... and ${byLevel.info.length - 10} more\n`
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
    const errorMessage = error instanceof Error ? error.message : String(error)

    console.error("[read-server-logs] Error:", error)

    let troubleshooting = "\n\n**Troubleshooting:**"
    if (errorMessage.includes("timeout")) {
      troubleshooting += "\n- The API request timed out (>15 seconds)"
      troubleshooting += "\n- Try reducing the number of lines or time range"
    } else if (errorMessage.includes("JSON") || errorMessage.includes("parse")) {
      troubleshooting += "\n- Failed to parse API response"
      troubleshooting += "\n- This may indicate a server error"
    } else {
      troubleshooting += `\n- ${errorMessage}`
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `# Failed to Read Server Logs\n\n**Workspace:** ${params.workspace}\n\n**Error:** ${errorMessage}${troubleshooting}`,
        },
      ],
      isError: true,
    }
  }
}

export const readServerLogsTool = tool(
  "read_server_logs",
  `Reads systemd journal logs from a workspace's dev server. Captures Vite build output, errors, warnings, and server-side logs. Use this FIRST when debugging to see actual dev server errors.

Context-efficient mode: Use summary_only: true to get error/warning counts with sample messages (reduces token usage significantly).

Advanced filtering: Use search_regex for powerful pattern matching (e.g., "error|warn", "failed.*build").

Auto-suggests next actions based on log analysis.

Examples:
- read_server_logs({ workspace: "two.goalive.nl", summary_only: true }) - Quick overview (context-efficient)
- read_server_logs({ workspace: "demo.goalive.nl", search: "error" }) - Basic search
- read_server_logs({ workspace: "mysite.com", search_regex: "error|fail|exception" }) - Regex search
- read_server_logs({ workspace: "site.com", lines: 200, since: "1 hour ago" }) - Recent logs`,
  readServerLogsParamsSchema,
  async args => {
    return readServerLogs(args)
  },
)
