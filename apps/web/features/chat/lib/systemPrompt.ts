import { DEFAULT_VOICE_LANGUAGE, getLanguageDisplayName, type VoiceLanguage } from "@webalive/shared"
import { coreInstructionsReminder } from "./work"

/** Email providers that can be connected via OAuth */
type EmailProvider = "gmail" | "outlook"

interface SystemPromptParams {
  projectId?: string
  hasStripeMcpAccess?: boolean
  /** Connected email providers (replaces gmail-only hasGmailAccess) */
  connectedEmailProviders?: EmailProvider[]
  additionalContext?: string
  /** When set to a non-English language, instructs Claude to respond in that language */
  voiceLanguage?: VoiceLanguage
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
  const { projectId, hasStripeMcpAccess, connectedEmailProviders = [], additionalContext, voiceLanguage } = params

  const now = new Date()
  const currentDate = `${now.getDate()} ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][now.getMonth()]} ${now.getFullYear()}`

  let prompt = `Date: ${currentDate}. Current time: ${now.toISOString()}. Read the current project structure before making changes. The user is usually looking at a specific page — find which one.`

  if (voiceLanguage && voiceLanguage !== DEFAULT_VOICE_LANGUAGE) {
    const langName = getLanguageDisplayName(voiceLanguage)
    prompt += ` LANGUAGE: The user's preferred language is ${langName} (${voiceLanguage}). You MUST respond in ${langName}. All explanations, questions, and commentary must be in ${langName}. Code, file paths, and technical identifiers stay in English.`
  }

  if (hasStripeMcpAccess) {
    prompt +=
      " STRIPE: Use Stripe MCP tools for all payment-related requests. Do not implement payment features manually."
  }

  // Email provider instructions — only providers with a complete compose→send pipeline
  // get the "always use compose_email" instruction. Others still have read/search/archive.
  const readyProviders = connectedEmailProviders.filter(p => EMAIL_COMPOSE_PIPELINE_READY.has(p))

  for (const provider of readyProviders) {
    const tool = EMAIL_COMPOSE_TOOL[provider]
    const label = provider.toUpperCase()
    prompt += ` ${label}: Use ${tool} for all email requests. Never write emails as plain text — always use the tool so the user can review and send.`
  }

  if (readyProviders.length > 1) {
    prompt +=
      " MULTIPLE EMAIL ACCOUNTS: The user has multiple email accounts connected. When they ask to send or compose an email without specifying which account, ask which one to use. Never pick one silently."
  }

  if (projectId) {
    prompt += ` Project: ${projectId}.`
  }

  if (additionalContext) {
    prompt += ` ${additionalContext}`
  }

  prompt += ` ${coreInstructionsReminder}`

  return prompt
}
