import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { PATHS } from "@webalive/shared"

const CANONICAL_INFRA_ENV_KEYS = [
  "DATABASE_URL",
  "DATABASE_PASSWORD",
  "E2B_DOMAIN",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const

type CanonicalInfraEnvKey = (typeof CANONICAL_INFRA_ENV_KEYS)[number]
type CanonicalInfraEnv = Partial<Record<CanonicalInfraEnvKey, string>>

function normalizeEnvValue(raw: string): string {
  const trimmed = raw.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function parseEnvFile(raw: string): Record<string, string> {
  const parsed: Record<string, string> = {}

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed
    const separatorIndex = withoutExport.indexOf("=")
    if (separatorIndex <= 0) continue

    const key = withoutExport.slice(0, separatorIndex).trim()
    if (!key) continue

    const value = withoutExport.slice(separatorIndex + 1)
    parsed[key] = normalizeEnvValue(value)
  }

  return parsed
}

export function loadCanonicalInfraEnvFromFile(envFilePath: string): CanonicalInfraEnv {
  if (!existsSync(envFilePath)) {
    throw new Error(`Canonical infra env file not found: ${envFilePath}`)
  }

  const parsed = parseEnvFile(readFileSync(envFilePath, "utf-8"))
  const env: CanonicalInfraEnv = {}

  for (const key of CANONICAL_INFRA_ENV_KEYS) {
    const value = parsed[key]
    if (value) {
      env[key] = value
    }
  }

  return env
}

export function loadCanonicalInfraEnv(): CanonicalInfraEnv {
  if (!PATHS.ALIVE_ROOT) {
    return {}
  }

  return loadCanonicalInfraEnvFromFile(join(PATHS.ALIVE_ROOT, "apps/web/.env.production"))
}
