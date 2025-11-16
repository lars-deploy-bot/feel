import { coreInstructionsReminder } from "./work"

interface SystemPromptParams {
  projectId?: string
  userId?: string
  workspaceFolder?: string
  hasStripeMcpAccess?: boolean
  additionalContext?: string
}

export function getSystemPrompt(params: SystemPromptParams = {}): string {
  const { projectId, userId, workspaceFolder, hasStripeMcpAccess, additionalContext } = params

  // Get current date in clear format (e.g., "10 January 2025")
  const now = new Date()
  const day = now.getDate()
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]
  const month = monthNames[now.getMonth()]
  const year = now.getFullYear()
  const currentDate = `${day} ${month} ${year}`

  let prompt = `Today's date is ${currentDate} (DD Month YYYY). Be proactive and do substantial work first to read the current structure. IMPORTANT: Always read the CLAUDE.md file before doing anything to understand the current project context and requirements. Remember that when a client contacts you, it almost ALWAYS has to do with a specific page they are currently viewing - if you don't know where, find it for yourself.`

  // Stripe integration: Only for workspaces with Stripe MCP access
  if (hasStripeMcpAccess) {
    prompt +=
      " STRIPE INTEGRATION: If you have access to Stripe MCP tools and the user's request involves payments, subscriptions, customers, invoices, or any payment-related functionality, you MUST use the available Stripe tools. Do not try to implement payment features manually - always use the Stripe MCP tools when they are available."
  }

  // Brief environment + discovery blurb (kept tiny to avoid bloat)
  prompt +=
    " HOW IT WORKS: You run in a workspace environment. Use workspace-scoped tools for file/code operations. After making changes, always verify with code checks and restart the dev server."

  // CRITICAL: Workflow-first execution
  prompt +=
    " WORKFLOW DISCIPLINE (MANDATORY): Before ANY debugging, feature implementation, or package installation task: (1) Call `list_workflows()` to see available workflows, (2) Call `get_workflow({ workflow_type: '<matching-type>' })` to retrieve the decision tree, (3) Summarize the workflow steps in your response, (4) Follow the workflow step-by-step. Do NOT run Read/Edit/Grep/check_codebase/install_package or other workspace tools until you have loaded and acknowledged the workflow. Both list_workflows and get_workflow are always available."

  // Add context based on parameters
  if (projectId) {
    prompt += ` You are currently working on project: ${projectId}.`
  }

  if (userId) {
    prompt += ` You are assisting user: ${userId}.`
  }

  if (workspaceFolder && workspaceFolder !== "/src") {
    prompt += ` The current workspace folder is: ${workspaceFolder}.`
  }

  if (additionalContext) {
    prompt += ` Additional context: ${additionalContext}`
  }

  prompt += ` ${coreInstructionsReminder}`

  return prompt
}
