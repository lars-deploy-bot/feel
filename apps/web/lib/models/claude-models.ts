/**
 * Claude model definitions and validation
 * Extracted to avoid circular dependency with type guards
 */

export const CLAUDE_MODELS = {
  SONNET_4_5: "claude-sonnet-4-5-20250929",
  HAIKU_4_5: "claude-haiku-4-5",
} as const

export type ClaudeModel = (typeof CLAUDE_MODELS)[keyof typeof CLAUDE_MODELS]

/**
 * Default model used for credit users and as initial state
 * Single source of truth for default model selection
 */
export const DEFAULT_MODEL: ClaudeModel = CLAUDE_MODELS.HAIKU_4_5

const VALID_MODELS = new Set<string>(Object.values(CLAUDE_MODELS))

export function isValidClaudeModel(value: unknown): value is ClaudeModel {
  return typeof value === "string" && VALID_MODELS.has(value)
}
