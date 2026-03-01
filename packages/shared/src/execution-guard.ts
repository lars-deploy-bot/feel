/**
 * Automation Execution Guard
 *
 * Operational safety rail:
 * - automations execute only in STREAM_ENV=production
 * - and only on the primary server (automationPrimary: true in server-config.json)
 */

import { DEFAULTS, STREAM_ENV } from "./config.js"

export interface AutomationExecutionGate {
  allowed: boolean
  reason: string
}

export function getAutomationExecutionGate(input?: {
  streamEnv?: string
  isAutomationPrimary?: boolean
}): AutomationExecutionGate {
  const streamEnv = input?.streamEnv ?? process.env.STREAM_ENV
  const isAutomationPrimary = input?.isAutomationPrimary ?? DEFAULTS.IS_AUTOMATION_PRIMARY

  if (streamEnv !== STREAM_ENV.PRODUCTION) {
    return {
      allowed: false,
      reason: `STREAM_ENV must be production (got ${streamEnv ?? "unset"})`,
    }
  }

  if (!isAutomationPrimary) {
    return {
      allowed: false,
      reason: "Automations are disabled on this server (automationPrimary is not set)",
    }
  }

  return { allowed: true, reason: "ok" }
}
