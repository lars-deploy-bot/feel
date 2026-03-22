/**
 * Agent/automation validation constraints.
 *
 * SINGLE SOURCE OF TRUTH — used by:
 *   - API Zod schemas (schemas.ts)
 *   - Agent editor form (AgentEditView)
 *   - Worker executor
 *
 * If you change a constraint here, both client and server pick it up.
 */

export const AGENT_CONSTRAINTS = {
  NAME_MIN: 1,
  NAME_MAX: 100,
  PROMPT_MIN: 10,
  PROMPT_MAX: 10_000,
  SCHEDULE_TEXT_MAX: 200,
  TIMEOUT_MIN: 10,
  TIMEOUT_MAX: 3600,
} as const

export const AGENT_ERRORS = {
  NAME_REQUIRED: "Name is required",
  NAME_TOO_SHORT: `Name must be at least ${AGENT_CONSTRAINTS.NAME_MIN} character`,
  NAME_TOO_LONG: `Name must be under ${AGENT_CONSTRAINTS.NAME_MAX} characters`,
  PROMPT_REQUIRED: "Prompt is required",
  PROMPT_TOO_SHORT: `Prompt must be at least ${AGENT_CONSTRAINTS.PROMPT_MIN} characters`,
  PROMPT_TOO_LONG: `Prompt must be under ${AGENT_CONSTRAINTS.PROMPT_MAX.toLocaleString()} characters`,
  SCHEDULE_REQUIRED: "Schedule is required",
  TIMEOUT_INVALID: `Timeout must be ${AGENT_CONSTRAINTS.TIMEOUT_MIN}–${AGENT_CONSTRAINTS.TIMEOUT_MAX} seconds`,
  SITE_REQUIRED: "No site available",
} as const

/**
 * Validate a single agent form field. Returns error message or null.
 */
export function validateAgentField(field: "name" | "prompt" | "schedule" | "timeout", value: string): string | null {
  switch (field) {
    case "name": {
      const v = value.trim()
      if (v.length === 0) return AGENT_ERRORS.NAME_REQUIRED
      if (v.length < AGENT_CONSTRAINTS.NAME_MIN) return AGENT_ERRORS.NAME_TOO_SHORT
      if (v.length > AGENT_CONSTRAINTS.NAME_MAX) return AGENT_ERRORS.NAME_TOO_LONG
      return null
    }
    case "prompt": {
      const v = value.trim()
      if (v.length === 0) return AGENT_ERRORS.PROMPT_REQUIRED
      if (v.length < AGENT_CONSTRAINTS.PROMPT_MIN) return AGENT_ERRORS.PROMPT_TOO_SHORT
      if (v.length > AGENT_CONSTRAINTS.PROMPT_MAX) return AGENT_ERRORS.PROMPT_TOO_LONG
      return null
    }
    case "schedule": {
      if (value.trim().length === 0) return AGENT_ERRORS.SCHEDULE_REQUIRED
      return null
    }
    case "timeout": {
      if (value === "") return null // optional
      const n = Number(value)
      if (!Number.isFinite(n) || n < AGENT_CONSTRAINTS.TIMEOUT_MIN || n > AGENT_CONSTRAINTS.TIMEOUT_MAX) {
        return AGENT_ERRORS.TIMEOUT_INVALID
      }
      return null
    }
  }
}

/** Field-level error map */
export type AgentFieldErrors = Partial<Record<"name" | "prompt" | "schedule" | "timeout", string>>

/**
 * Validate all fields for create mode. Returns null if valid.
 */
export function validateAgentCreate(fields: {
  name: string
  prompt: string
  schedule: string
  timeout: string
}): AgentFieldErrors | null {
  const errors: AgentFieldErrors = {}
  for (const key of ["name", "prompt", "schedule", "timeout"] as const) {
    const err = validateAgentField(key, fields[key])
    if (err) errors[key] = err
  }
  return Object.keys(errors).length > 0 ? errors : null
}
