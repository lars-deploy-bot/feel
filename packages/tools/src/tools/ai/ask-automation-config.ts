/**
 * Ask Automation Config Tool
 *
 * Presents an interactive form to configure a scheduled automation.
 * Returns structured data that the frontend renders as a multi-step form.
 *
 * The user can:
 * 1. Enter a task name and prompt
 * 2. Select a website
 * 3. Choose a schedule (once, daily, weekly, monthly, custom cron)
 *
 * After submission, the frontend uses the captured values to create the automation directly.
 */

import { tool } from "@anthropic-ai/claude-agent-sdk"
import { CLAUDE_MODELS } from "@webalive/shared"
import { z } from "zod"
import { api } from "../../lib/tools-api.js"
import { extractDomainFromWorkspace } from "../../lib/workspace-validator.js"

const ClaudeModelSchema = z.enum(Object.values(CLAUDE_MODELS) as [string, ...string[]])

export const askAutomationConfigParamsSchema = {
  context: z.string().optional().describe("Optional context about why an automation is being created"),
  defaultSiteId: z.string().optional().describe("Optional default site ID to pre-select"),
  defaultName: z.string().optional().describe("Optional default task name to pre-fill"),
  defaultPrompt: z.string().optional().describe("Optional default prompt to pre-fill"),
  defaultModel: ClaudeModelSchema.optional().describe("Optional default model to pre-fill"),
}

export type AskAutomationConfigParams = {
  context?: string
  defaultSiteId?: string
  defaultName?: string
  defaultPrompt?: string
  defaultModel?: z.infer<typeof ClaudeModelSchema>
}

export interface AskAutomationConfigResult {
  content: Array<{ type: "text"; text: string }>
  isError: boolean
  [key: string]: unknown
}

interface SiteOption {
  id: string
  hostname: string
}

/**
 * Fetch the user's sites from the API using the typed client.
 */
async function fetchUserSites(): Promise<SiteOption[]> {
  const data = await api().getty("sites")
  return data.sites.map(s => ({ id: s.id, hostname: s.hostname }))
}

function getCurrentWorkspaceHostname(): string | undefined {
  try {
    return extractDomainFromWorkspace(process.cwd())
  } catch {
    return undefined
  }
}

export function scopeAutomationSitesForForm({
  sites,
  defaultSiteId,
  workspaceHostname,
}: {
  sites: SiteOption[]
  defaultSiteId?: string
  workspaceHostname?: string
}): { sites: SiteOption[]; defaultSiteId?: string } {
  if (sites.length === 0) {
    return { sites }
  }

  if (defaultSiteId) {
    const byId = sites.find(site => site.id === defaultSiteId)
    if (byId) {
      return { sites: [byId], defaultSiteId: byId.id }
    }
  }

  if (workspaceHostname) {
    const byWorkspace = sites.find(site => site.hostname === workspaceHostname)
    if (byWorkspace) {
      return { sites: [byWorkspace], defaultSiteId: byWorkspace.id }
    }
  }

  if (sites.length === 1) {
    return { sites, defaultSiteId: sites[0]?.id }
  }

  return { sites }
}

/**
 * Show the automation configuration form to the user.
 *
 * Fetches the user's sites from the API, then returns JSON
 * that the frontend renders as an interactive multi-step form.
 */
export async function askAutomationConfig(params: AskAutomationConfigParams): Promise<AskAutomationConfigResult> {
  try {
    const { context: userContext, defaultSiteId, defaultName, defaultPrompt, defaultModel } = params

    const availableSites = await fetchUserSites()
    const workspaceHostname = getCurrentWorkspaceHostname()
    const scoped = scopeAutomationSitesForForm({
      sites: availableSites,
      defaultSiteId,
      workspaceHostname,
    })
    const sites = scoped.sites

    if (sites.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No websites available. Please create a website first before setting up automations.",
          },
        ],
        isError: true,
      }
    }

    const responseData = {
      type: "automation_config",
      sites,
      defaultSiteId: scoped.defaultSiteId,
      context: userContext,
      defaultName,
      defaultPrompt,
      defaultModel,
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(responseData),
        },
      ],
      isError: false,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      content: [
        {
          type: "text",
          text: `Error creating automation config form: ${errorMessage}`,
        },
      ],
      isError: true,
    }
  }
}

export const askAutomationConfigTool = tool(
  "ask_automation_config",
  `Show an interactive form for the user to configure a scheduled automation.

Use this tool when:
- The user wants to create a scheduled task or automation
- The user says something like "schedule a task", "set up an automation", "remind me daily", "run something every week"
- You need to collect automation details (name, prompt, schedule, website)
- You can pre-fill task details from what the user already asked for

Site scoping behavior:
- In a website chat, the form is scoped to the current website by default
- If defaultSiteId is provided and valid, the form is scoped to that site

The form collects:
1. **Task name** - What to call this automation
2. **Prompt** - What Claude should do when the automation runs
3. **Website** - Which site this automation is for
4. **Schedule** - When to run (once, daily, weekly, monthly, or custom cron)
5. **Model** - Which model the automation should use

When calling this tool:
- ALWAYS pre-fill known values via defaultName/defaultPrompt/defaultModel/defaultSiteId
- Use concise, task-specific defaults from the user's request

After the user submits, the frontend creates the automation directly.
DO NOT call create_automation directly after this form.
Wait for the user's confirmation message from the UI.

Example flow:
1. User: "Set up a daily task to check my website"
2. You: Call ask_automation_config to show the form
3. User submits form in UI
4. UI creates automation and sends you an informational confirmation`,
  askAutomationConfigParamsSchema,
  async args => {
    return askAutomationConfig(args)
  },
)
