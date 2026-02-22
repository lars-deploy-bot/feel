/**
 * create_automation - Create a new automation via the typed API client
 *
 * Wraps POST /api/automations so Claude can create automations
 * after the user fills the ask_automation_config form.
 */

import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { errorResult, type ToolResult } from "../../lib/api-client.js"
import { ApiError, api, validateToolsRequest } from "../../lib/tools-api.js"

export const createAutomationParamsSchema = {
  site_id: z.string().min(1).describe("Domain ID of the site this automation is for"),
  name: z.string().min(1).describe("Human-readable name for the automation"),
  trigger_type: z
    .enum(["cron", "one-time"])
    .describe("How the automation is triggered: 'cron' for recurring, 'one-time' for single execution"),
  action_type: z.enum(["prompt"]).describe("Action type — currently only 'prompt' is supported"),
  action_prompt: z.string().min(1).describe("The prompt Claude will execute when the automation runs"),
  cron_schedule: z.string().optional().describe("Cron expression (required for trigger_type=cron), e.g. '0 9 * * *'"),
  cron_timezone: z.string().optional().describe("Timezone for the cron schedule, e.g. 'Europe/Amsterdam'"),
  run_at: z.string().optional().describe("ISO timestamp for one-time triggers"),
  action_model: z.string().optional().describe("Model override, e.g. 'claude-sonnet-4-6-20250514'"),
  is_active: z.boolean().optional().describe("Whether the automation starts active (default: true)"),
}

export async function createAutomation(
  params: z.infer<z.ZodObject<typeof createAutomationParamsSchema>>,
): Promise<ToolResult> {
  if (params.trigger_type === "cron" && !params.cron_schedule) {
    return errorResult("Invalid automation configuration", "cron_schedule is required for cron automations.")
  }

  if (params.trigger_type === "one-time" && !params.run_at) {
    return errorResult("Invalid automation configuration", "run_at is required for one-time automations.")
  }

  if (params.run_at) {
    const parsed = new Date(params.run_at)
    if (Number.isNaN(parsed.getTime())) {
      return errorResult("Invalid automation configuration", "run_at must be a valid ISO timestamp.")
    }
  }

  try {
    const validated = validateToolsRequest("automations/create", {
      site_id: params.site_id,
      name: params.name,
      trigger_type: params.trigger_type,
      action_type: params.action_type,
      action_prompt: params.action_prompt,
      cron_schedule: params.cron_schedule ?? null,
      cron_timezone: params.cron_timezone ?? null,
      run_at: params.run_at ?? null,
      action_model: params.action_model ?? null,
      skills: [],
      is_active: params.is_active ?? true,
    })
    const data = await api().postty("automations/create", validated)

    const { automation } = data
    const status = automation.is_active ? "active" : "paused"
    const schedule = describeSchedule(automation)

    return {
      content: [
        {
          type: "text",
          text: `Automation created successfully.

**Name:** ${automation.name}
**Automation ID:** ${automation.id}
**Site ID:** ${automation.site_id}
**Schedule:** ${schedule}
**Status:** ${status}`,
        },
      ],
      isError: false,
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return errorResult("Failed to create automation", error.message)
    }
    throw error
  }
}

function describeSchedule(automation: {
  trigger_type: string
  cron_schedule: string | null
  cron_timezone: string | null
  run_at: string | null
}): string {
  if (automation.trigger_type === "cron") {
    const cron = automation.cron_schedule ?? "(missing cron expression)"
    const tz = automation.cron_timezone ? ` (${automation.cron_timezone})` : ""
    return `cron: ${cron}${tz}`
  }

  if (automation.trigger_type === "one-time") {
    return automation.run_at ? `one-time at ${automation.run_at}` : "one-time"
  }

  return automation.trigger_type
}

export const createAutomationTool = tool(
  "create_automation",
  `Create a new automation that runs Claude on a schedule or one-time.

Use this after the user submits the automation configuration form (ask_automation_config).

REQUIRED FIELDS:
- site_id: The domain ID (from ask_automation_config form or list_automations)
- name: Human-readable name
- trigger_type: "cron" (recurring) or "one-time" (single run)
- action_type: "prompt" (the only type currently)
- action_prompt: What Claude should do when the automation runs

FOR CRON TRIGGERS (trigger_type="cron"):
- cron_schedule: Cron expression like "0 9 * * *" (required)
- cron_timezone: Timezone like "Europe/Amsterdam" (optional, defaults to UTC)

FOR ONE-TIME TRIGGERS (trigger_type="one-time"):
- run_at: ISO timestamp like "2026-03-01T09:00:00Z" (required)

OPTIONAL:
- action_model: Model override (default: server default model)
- is_active: Whether to activate immediately (default: true)`,
  createAutomationParamsSchema,
  async args => {
    return createAutomation(args)
  },
)
