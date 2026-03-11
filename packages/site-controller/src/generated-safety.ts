import { existsSync, readFileSync } from "node:fs"

const MIN_EXISTING_COUNT_FOR_DROP_GUARD = 20
const MAX_ALLOWED_DROP_RATIO = 0.5

interface GeneratedCountGuardParams {
  kind: string
  filePath: string
  existingCount: number
  nextCount: number
}

function shouldBlockCountDrop(existingCount: number, nextCount: number): boolean {
  if (existingCount < MIN_EXISTING_COUNT_FOR_DROP_GUARD) {
    return false
  }

  return nextCount < existingCount * MAX_ALLOWED_DROP_RATIO
}

export function assertNoDangerousCountDrop(params: GeneratedCountGuardParams): void {
  const { kind, filePath, existingCount, nextCount } = params

  if (!shouldBlockCountDrop(existingCount, nextCount)) {
    return
  }

  throw new Error(
    `[generated-safety] Refusing to overwrite ${kind}: existing count ${existingCount}, ` +
      `new count ${nextCount} (${filePath}). This looks like a broken DB view or wrong credentials.`,
  )
}

export function readExistingPortMapCount(filePath: string): number {
  if (!existsSync(filePath)) {
    return 0
  }

  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, "utf-8"))
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return 0
    }

    return Object.keys(parsed).length
  } catch {
    return 0
  }
}

export function readExistingGeneratedCaddyDomainCount(filePath: string): number {
  if (!existsSync(filePath)) {
    return 0
  }

  const content = readFileSync(filePath, "utf-8")
  const match = content.match(/^# domains: (\d+)$/m)
  if (!match) {
    return 0
  }

  return Number.parseInt(match[1], 10)
}
