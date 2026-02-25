import { PAGINATION } from "../config/constants"

export function encodeCursor(id: string, createdAt: string): string {
  const raw = JSON.stringify({ id, createdAt })
  return Buffer.from(raw).toString("base64url")
}

export function decodeCursor(cursor: string): { id: string; createdAt: string } {
  const raw = Buffer.from(cursor, "base64url").toString("utf-8")
  const parsed: unknown = JSON.parse(raw)

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("id" in parsed) ||
    !("createdAt" in parsed) ||
    typeof (parsed as Record<string, unknown>).id !== "string" ||
    typeof (parsed as Record<string, unknown>).createdAt !== "string"
  ) {
    throw new Error("Invalid cursor format")
  }

  return parsed as { id: string; createdAt: string }
}

export function clampLimit(limit: number | undefined): number {
  if (limit === undefined) return PAGINATION.DEFAULT_LIMIT
  if (limit < 1) return 1
  if (limit > PAGINATION.MAX_LIMIT) return PAGINATION.MAX_LIMIT
  return limit
}
