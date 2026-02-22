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
  site_id: z.string().optional().describe("Filter by site/domain ID or hostname"),
}

const listAutomationsRuntimeParamsSchema = z.object(listAutomationsParamsSchema).strict()

function formatTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp)
  return Number.isNaN(parsed.getTime()) ? timestamp : parsed.toISOString()
}

export async function listAutomations(
  params: z.infer<z.ZodObject<typeof listAutomationsParamsSchema>>,
): Promise<ToolResult> {
  const parsedParams = listAutomationsRuntimeParamsSchema.safeParse(params)
  if (!parsedParams.success) {
    const message = parsedParams.error.issues.map(issue => issue.message).join("; ")
    return errorResult("Invalid automation filter", message || "Input validation failed.")
  }

  const safeParams = parsedParams.data

  try {
    let resolvedSiteId: string | undefined
    if (safeParams.site_id) {
      const sites = await api().getty("sites")
      const matchedSite = sites.sites.find(
        site => site.id === safeParams.site_id || site.hostname === safeParams.site_id,
      )
      if (!matchedSite) {
        return errorResult("Invalid automation filter", "site_id is not accessible for the current user.")
      }
      resolvedSiteId = matchedSite.id
    }

    const queryParams = resolvedSiteId ? `?site_id=${encodeURIComponent(resolvedSiteId)}` : ""

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
- site_id: Only show automations for a specific site (site ID or hostname)`,
  listAutomationsParamsSchema,
  async args => {
    return listAutomations(args)
  },
)
