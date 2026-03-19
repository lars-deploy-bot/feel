/**
 * Automation Execution Guard
 *
 * Operational safety rail:
 * - automations execute only in ALIVE_ENV=production
 * - and only on the primary server (automationPrimary: true in server-config.json)
 */

import { DEFAULTS, ALIVE_ENV } from "./config.js"

export interface AutomationExecutionGate {
  allowed: boolean
  reason: string
}

export function getAutomationExecutionGate(input?: {
  aliveEnv?: string
  isAutomationPrimary?: boolean
}): AutomationExecutionGate {
  const aliveEnv = input?.aliveEnv ?? process.env.ALIVE_ENV
  const isAutomationPrimary = input?.isAutomationPrimary ?? DEFAULTS.IS_AUTOMATION_PRIMARY

  if (aliveEnv !== ALIVE_ENV.PRODUCTION) {
    return {
      allowed: false,
      reason: `ALIVE_ENV must be production (got ${aliveEnv ?? "unset"})`,
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
