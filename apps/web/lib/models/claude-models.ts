/**
 * Claude model definitions and validation
 * Extracted to avoid circular dependency with type guards
 */

export const CLAUDE_MODELS = {
  OPUS_4_5: "claude-opus-4-5",
  SONNET_4_5: "claude-sonnet-4-5",
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

export function getModelDisplayName(model: ClaudeModel): string {
  switch (model) {
    case CLAUDE_MODELS.OPUS_4_5:
      return "Claude Opus 4.5"
    case CLAUDE_MODELS.SONNET_4_5:
      return "Claude Sonnet 4.5"
    case CLAUDE_MODELS.HAIKU_4_5:
      return "Claude Haiku 4.5"
    default:
      return model
  }
}
