/**
 * trigger_automation - Manually trigger an automation via the typed API client
 *
 * Wraps POST /api/automations/[id]/trigger to run an automation immediately.
 */

import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { errorResult, type ToolResult } from "../../lib/api-client.js"
import { ApiError, api, validateToolsRequest } from "../../lib/tools-api.js"

export const triggerAutomationParamsSchema = {
  automation_id: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9_-]+$/, "automation_id must contain only alphanumeric characters, hyphens, or underscores")
    .describe("The automation job ID to trigger"),
}

export async function triggerAutomation(
  params: z.infer<z.ZodObject<typeof triggerAutomationParamsSchema>>,
): Promise<ToolResult> {
  try {
    const validated = validateToolsRequest("automations/trigger", {})
    const data = await api().postty(
      "automations/trigger",
      validated,
      undefined,
      `/api/automations/${params.automation_id}/trigger`,
    )

    return {
      content: [
        {
          type: "text",
          text: `Automation queued successfully.

**Automation ID:** ${params.automation_id}
**Status:** ${data.status}
**Started At:** ${data.startedAt}
**Timeout:** ${data.timeoutSeconds}s
**Runs API:** ${data.monitor.runsPath}`,
        },
      ],
      isError: false,
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return errorResult("Failed to trigger automation", error.message)
    }
    throw error
  }
}

export const triggerAutomationTool = tool(
  "trigger_automation",
  `Manually trigger an automation to run immediately, bypassing its schedule.

Use this when the user wants to test an automation or run it right now.
The automation runs asynchronously — this returns immediately with a "queued" status.

REQUIRED:
- automation_id: The ID of the automation to trigger (get it from list_automations)`,
  triggerAutomationParamsSchema,
  async args => {
    return triggerAutomation(args)
  },
)
