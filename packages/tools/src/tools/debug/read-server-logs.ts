import { exec } from "node:child_process"
import { promisify } from "node:util"
import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"

const execAsync = promisify(exec)

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
  lines: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .default(100)
    .describe("Number of log lines to retrieve (default: 100, max: 1000)"),
  since: z.string().optional().describe('Time range (e.g., "5 minutes ago", "1 hour ago", "today")'),
}

export type ReadServerLogsParams = {
  workspace: string
  search?: string
  lines?: number
  since?: string
}

export type ReadServerLogsResult = {
  content: Array<{ type: "text"; text: string }>
  isError: boolean
}

function validateWorkspace(workspace: string): { valid: boolean; error?: string } {
  if (!workspace || workspace.trim().length === 0) {
    return { valid: false, error: "Workspace cannot be empty" }
  }

  const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i
  if (!domainRegex.test(workspace)) {
    return {
      valid: false,
      error: `Invalid workspace format: "${workspace}". Must be a valid domain (e.g., two.goalive.nl)`,
    }
  }

  return { valid: true }
}

function workspaceToServiceName(workspace: string): string {
  return `site@${workspace.replace(/\./g, "-")}.service`
}

async function serviceExists(serviceName: string): Promise<{ exists: boolean; status?: string; error?: string }> {
  try {
    const { stdout } = await execAsync(`systemctl show ${serviceName} --property=LoadState,ActiveState`, {
      timeout: 5000,
    })

    const lines = stdout.trim().split("\n")
    const loadState = lines.find(l => l.startsWith("LoadState="))?.split("=")[1]
    const activeState = lines.find(l => l.startsWith("ActiveState="))?.split("=")[1]

    if (loadState === "not-found") {
      return {
        exists: false,
        error: `Service ${serviceName} does not exist. The workspace may not be deployed yet.`,
      }
    }

    return {
      exists: true,
      status: activeState || "unknown",
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (errorMessage.includes("not be found") || errorMessage.includes("not loaded")) {
      return {
        exists: false,
        error: "Service not found. The workspace may not be deployed.",
      }
    }

    return {
      exists: false,
      error: `Failed to check service status: ${errorMessage}`,
    }
  }
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
  const { workspace, search, lines = 100, since } = params

  try {
    const validation = validateWorkspace(workspace)
    if (!validation.valid) {
      return {
        content: [
          {
            type: "text" as const,
            text: `# Invalid Workspace\n\n${validation.error}\n\n**Examples of valid workspaces:**\n- two.goalive.nl\n- demo.goalive.nl\n- mysite.example.com`,
          },
        ],
        isError: true,
      }
    }

    const serviceName = workspaceToServiceName(workspace)

    console.log(`[read-server-logs] Checking if service exists: ${serviceName}`)
    const serviceCheck = await serviceExists(serviceName)

    if (!serviceCheck.exists) {
      return {
        content: [
          {
            type: "text" as const,
            text: `# Service Not Found\n\n**Workspace:** ${workspace}\n**Service:** ${serviceName}\n\n${serviceCheck.error}\n\n**Troubleshooting:**\n1. Verify the workspace domain is correct\n2. Check if the site is deployed: \`systemctl list-units | grep site@\`\n3. Ensure the site was deployed with systemd (not PM2)\n4. Try listing all sites: \`ls /srv/webalive/sites/\``,
          },
        ],
        isError: true,
      }
    }

    console.log(`[read-server-logs] Service ${serviceName} exists (status: ${serviceCheck.status})`)

    const lineLimit = Math.min(Math.max(1, lines), 1000)
    let cmd = `journalctl -u "${serviceName}" -n ${lineLimit} --no-pager --output=short-iso`

    if (since) {
      const validSincePatterns = /^(\d+\s+(second|minute|hour|day|week|month|year)s?\s+ago|today|yesterday)$/i
      if (validSincePatterns.test(since)) {
        cmd += ` --since "${since}"`
      } else {
        console.warn(`[read-server-logs] Invalid 'since' parameter: ${since}, ignoring`)
      }
    }

    console.log(`[read-server-logs] Running: ${cmd}`)

    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 10000,
      maxBuffer: 10 * 1024 * 1024,
    })

    if (stderr && !stdout) {
      throw new Error(stderr)
    }

    if (!stdout.trim()) {
      return {
        content: [
          {
            type: "text" as const,
            text: `# No Logs Available\n\n**Workspace:** ${workspace}\n**Service:** ${serviceName}\n**Status:** ${serviceCheck.status}\n\nThe service exists but has no logs yet.\n\n**Possible reasons:**\n- Service just started\n- Service hasn't generated any output\n- Logs may have been rotated\n\n**Try:**\n- Use a longer time range: \`since: "1 hour ago"\`\n- Check service status: \`systemctl status ${serviceName}\``,
          },
        ],
        isError: false,
      }
    }

    let logs = parseJournalctlOutput(stdout)

    if (search) {
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
            text: search
              ? `# No Matching Logs\n\n**Workspace:** ${workspace}\n**Search:** "${search}"\n**Total logs scanned:** ${parseJournalctlOutput(stdout).length}\n\nNo logs matched your search term.\n\n**Try:**\n- Different search term\n- Remove the search filter\n- Expand time range with \`since\` parameter`
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
    output += `**Status:** ${serviceCheck.status}\n`
    output += `**Total logs:** ${logs.length}\n`
    if (search) {
      output += `**Filtered by:** "${search}"\n`
    }
    if (since) {
      output += `**Time range:** ${since}\n`
    }
    output += "\n"

    output += "## Summary\n"
    const errorCount = byLevel.error?.length || 0
    const warnCount = byLevel.warn?.length || 0
    const successCount = byLevel.success?.length || 0
    const infoCount = byLevel.info?.length || 0

    if (errorCount > 0) output += `- **Errors:** ${errorCount} ❌\n`
    if (warnCount > 0) output += `- **Warnings:** ${warnCount} ⚠️\n`
    if (successCount > 0) output += `- **Success:** ${successCount} ✓\n`
    if (infoCount > 0) output += `- **Info:** ${infoCount}\n`
    output += "\n---\n\n"

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
    if (errorMessage.includes("permission") || errorMessage.includes("denied")) {
      troubleshooting += "\n- Permission denied to read logs"
      troubleshooting += "\n- Ensure the process has access to systemd journal"
    } else if (errorMessage.includes("timeout")) {
      troubleshooting += "\n- The command timed out (>10 seconds)"
      troubleshooting += "\n- Try reducing the number of lines or time range"
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

Examples:
- read_server_logs({ workspace: "two.goalive.nl" })
- read_server_logs({ workspace: "demo.goalive.nl", search: "error" })
- read_server_logs({ workspace: "mysite.com", lines: 200, since: "1 hour ago" })`,
  readServerLogsParamsSchema,
  async args => {
    return readServerLogs(args)
  },
)
