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

export function readCanonicalInfraEnvFromProcess(processEnv: NodeJS.ProcessEnv = process.env): CanonicalInfraEnv {
  const env: CanonicalInfraEnv = {}

  for (const key of CANONICAL_INFRA_ENV_KEYS) {
    const value = processEnv[key]
    if (value) {
      env[key] = value
    }
  }

  return env
}

export function mergeCanonicalInfraEnv(fileEnv: CanonicalInfraEnv, runtimeEnv: CanonicalInfraEnv): CanonicalInfraEnv {
  return {
    ...fileEnv,
    ...runtimeEnv,
  }
}

export function loadCanonicalInfraEnv(): CanonicalInfraEnv {
  const runtimeEnv = readCanonicalInfraEnvFromProcess()

  if (!PATHS.ALIVE_ROOT) {
    return runtimeEnv
  }

  const fileEnv = loadCanonicalInfraEnvFromFile(join(PATHS.ALIVE_ROOT, "apps/web/.env.production"))

  // Runtime-loaded env must win so staging/dev services do not get silently
  // overridden by production credentials from the canonical file.
  return mergeCanonicalInfraEnv(fileEnv, runtimeEnv)
}

/**
 * Load infra env ONLY from the canonical file (.env.production).
 * Ignores runtime env vars entirely.
 *
 * Use this for server-wide infrastructure generation (port-map, Caddy routing)
 * where the output is a shared artifact under /var/lib/alive/generated/.
 * These generators must always query the production/canonical DB regardless
 * of which environment's process invokes them (staging, dev, etc.).
 */
export function loadCanonicalInfraEnvFileOnly(): CanonicalInfraEnv {
  if (!PATHS.ALIVE_ROOT) {
    throw new Error(
      "[infra-env] ALIVE_ROOT is not set. Server-wide infra generation requires the canonical .env.production file.",
    )
  }

  return loadCanonicalInfraEnvFromFile(join(PATHS.ALIVE_ROOT, "apps/web/.env.production"))
}
