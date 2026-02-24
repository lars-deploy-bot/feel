import { coreInstructionsReminder } from "./work"

/** Email providers that can be connected via OAuth */
type EmailProvider = "gmail" | "outlook"

interface SystemPromptParams {
  projectId?: string
  userId?: string
  workspaceFolder?: string
  hasStripeMcpAccess?: boolean
  /** Connected email providers (replaces gmail-only hasGmailAccess) */
  connectedEmailProviders?: EmailProvider[]
  additionalContext?: string
  isProduction?: boolean
}

/** MCP compose tool name per email provider */
const EMAIL_COMPOSE_TOOL: Record<EmailProvider, string> = {
  gmail: "mcp__gmail__compose_email",
  outlook: "mcp__outlook__compose_email",
}

/**
 * Providers with a complete compose → UI renderer → send/draft pipeline.
 * Only these get the "use compose_email for all email requests" instruction.
 */
const EMAIL_COMPOSE_PIPELINE_READY = new Set<EmailProvider>(["gmail", "outlook"])

export function getSystemPrompt(params: SystemPromptParams = {}): string {
  const {
    projectId,
    userId,
    workspaceFolder,
    hasStripeMcpAccess,
    connectedEmailProviders = [],
    additionalContext,
    isProduction,
  } = params

  const now = new Date()
  const currentDate = `${now.getDate()} ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][now.getMonth()]} ${now.getFullYear()}`

  let prompt = `Date: ${currentDate}. Current time: ${now.toISOString()}. Read CLAUDE.md first. Read the current project structure before making changes. The user is usually looking at a specific page — find which one.`

  if (hasStripeMcpAccess) {
    prompt +=
      " STRIPE: Use Stripe MCP tools for all payment-related requests. Do not implement payment features manually."
  }

  // Email provider instructions — only providers with a complete compose→send pipeline
  // get the "always use compose_email" instruction. Others still have read/search/archive.
  for (const provider of connectedEmailProviders) {
    if (!EMAIL_COMPOSE_PIPELINE_READY.has(provider)) continue
    const tool = EMAIL_COMPOSE_TOOL[provider]
    const label = provider.toUpperCase()
    prompt += ` ${label}: Use ${tool} for all email requests. Never write emails as plain text — always use the tool so the user can review and send.`
    // TODO(calendar): When Outlook calendar is wired, add calendar guidance here
    // (e.g., "Use mcp__outlook_calendar__compose_event for scheduling requests.")
  }

  prompt +=
    " Before debugging, installing packages, or implementing features: call list_workflows() then get_workflow() and follow the steps."

  if (projectId) {
    prompt += ` Project: ${projectId}.`
  }

  if (userId) {
    prompt += ` User: ${userId}.`
  }

  if (workspaceFolder && workspaceFolder !== "/src") {
    prompt += ` Workspace: ${workspaceFolder}.`
  }

  if (additionalContext) {
    prompt += ` ${additionalContext}`
  }

  if (isProduction) {
    prompt +=
      " PRODUCTION MODE: Changes are not live until you rebuild. Make all changes first, then run switch_serve_mode({ mode: 'build' }) once. Or switch to dev mode for live editing."
  }

  prompt += ` ${coreInstructionsReminder}`

  return prompt
}
