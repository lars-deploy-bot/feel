/**
 * list_automations - List the user's automations via the typed API client
 *
 * Wraps GET /api/automations so Claude can show automation status in chat.
 */

import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { errorResult, type ToolResult } from "../../lib/api-client.js"
import { ApiError, api } from "../../lib/tools-api.js"

export const listAutomationsParamsSchema = {
  site_id: z.string().optional().describe("Filter by site/domain ID"),
}

function formatTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp)
  return Number.isNaN(parsed.getTime()) ? timestamp : parsed.toISOString()
}

export async function listAutomations(
  params: z.infer<z.ZodObject<typeof listAutomationsParamsSchema>>,
): Promise<ToolResult> {
  try {
    const queryParams = params.site_id ? `?site_id=${encodeURIComponent(params.site_id)}` : ""

    const data = await api().getty("automations", undefined, `/api/automations${queryParams}`)
    const { automations, total } = data

    if (automations.length === 0) {
      return {
        content: [{ type: "text", text: "No automations found." }],
        isError: false,
      }
    }

    const count = total ?? automations.length
    const lines: string[] = [`Found ${count} automation(s):`, ""]

    for (const job of automations) {
      const status = job.is_active ? "active" : "paused"
      const schedule = job.cron_schedule ?? job.trigger_type
      const lastRun = job.last_run_at
        ? `${formatTimestamp(job.last_run_at)} (${job.last_run_status ?? "unknown"})`
        : "never"
      const nextRun = job.next_run_at ? formatTimestamp(job.next_run_at) : "none"

      lines.push(`- **${job.name}** (id: ${job.id})`)
      lines.push(`  Site: ${job.hostname ?? "unknown"} | Status: ${status} | Schedule: ${schedule}`)
      lines.push(`  Last: ${lastRun} | Next: ${nextRun}`)
      lines.push("")
    }

    return {
      content: [{ type: "text", text: lines.join("\n") }],
      isError: false,
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return errorResult("Failed to list automations", error.message)
    }
    throw error
  }
}

export const listAutomationsTool = tool(
  "list_automations",
  `List the user's automations with their status, schedule, and run history.

Use this to show the user their current automations, check if an automation is running,
or find an automation ID for triggering/updating.

Optional filter:
- site_id: Only show automations for a specific site`,
  listAutomationsParamsSchema,
  async args => {
    return listAutomations(args)
  },
)
