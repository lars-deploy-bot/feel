/**
 * Narrows `unknown` to `Record<string, unknown>`.
 * Excludes arrays, Date, RegExp, Map, Set, etc.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
