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

const triggerAutomationRuntimeParamsSchema = z.object(triggerAutomationParamsSchema).strict()

export async function triggerAutomation(
  params: z.infer<z.ZodObject<typeof triggerAutomationParamsSchema>>,
): Promise<ToolResult> {
  const parsedParams = triggerAutomationRuntimeParamsSchema.safeParse(params)
  if (!parsedParams.success) {
    const message = parsedParams.error.issues.map(issue => issue.message).join("; ")
    return errorResult("Invalid automation ID", message || "Input validation failed.")
  }

  const safeParams = parsedParams.data
  const encodedAutomationId = encodeURIComponent(safeParams.automation_id)

  try {
    const validated = validateToolsRequest("automations/trigger", undefined)
    const data = await api().postty(
      "automations/trigger",
      validated,
      undefined,
      `/api/automations/${encodedAutomationId}/trigger`,
    )

    return {
      content: [
        {
          type: "text",
          text: `Automation queued successfully.

**Automation ID:** ${safeParams.automation_id}
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
