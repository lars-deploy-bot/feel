/**
 * Claude model definitions and validation
 * Extracted to avoid circular dependency with type guards
 */

export const CLAUDE_MODELS = {
  SONNET_4_5: "claude-sonnet-4-5-20250929",
  OPUS_4: "claude-opus-4-20250514",
  HAIKU_3_5: "claude-3-5-haiku-20241022",
} as const

export type ClaudeModel = (typeof CLAUDE_MODELS)[keyof typeof CLAUDE_MODELS]

const VALID_MODELS = new Set<string>(Object.values(CLAUDE_MODELS))

export function isValidClaudeModel(value: unknown): value is ClaudeModel {
  return typeof value === "string" && VALID_MODELS.has(value)
}
