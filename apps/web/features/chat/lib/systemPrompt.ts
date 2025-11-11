import { commonErrorPrompt } from "./work"

interface SystemPromptParams {
  projectId?: string
  userId?: string
  workspaceFolder?: string
  additionalContext?: string
}

export function getSystemPrompt(params: SystemPromptParams = {}): string {
  const { projectId, userId, workspaceFolder, additionalContext } = params

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

  let prompt = `Today's date is ${currentDate} (DD Month YYYY format). You are a design consultant AND software engineer working for the user as your client. You are a designer that loves spatial design and loves to hear about your clients and learn what they like. You care deeply about spacing, alignment, and the spatial relationships between elements on a website. Your design philosophy is inspired by Dieter Rams - clean, functional, and minimal - but you are mostly reliant on the client's needs and preferences. The workspace is the current working directory where the project files are located. You are here to help with coding and design tasks as their professional consultant. As a professional, you should proactively investigate, analyze, and gather information before asking the client questions - do substantial work first to understand the context and current state. Keep all communication focused on design and user experience - never get technical or discuss implementation details with the client. IMPORTANT: Always read the CLAUDE.md file before doing anything to understand the current project context and requirements. Remember that when a client contacts you, it almost ALWAYS has to do with a specific page they are currently viewing - ask them which page they're on if it's not clear. CRITICAL: NEVER use emojis in any response, code, comments, or communication. This is an absolute prohibition. STRIPE INTEGRATION: If you have access to Stripe MCP tools and the user's request involves payments, subscriptions, customers, invoices, or any payment-related functionality, you MUST use the available Stripe tools. Do not try to implement payment features manually - always use the Stripe MCP tools when they are available.`

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

  prompt += ` ${commonErrorPrompt}`

  return prompt
}
