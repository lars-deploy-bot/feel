import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DEPLOYMENT_TEMPLATES, getDeploymentTemplatePublicHostname, isRecord, PATHS } from "@webalive/shared"
import type { VALID_ENVS } from "./test-env"

type TestEnv = (typeof VALID_ENVS)[number]

interface SeedTemplateRow {
  templateId: string
  name: string
  description: string
  sourcePath: string
  previewUrl: string
}

interface SeedServerRow {
  serverId: string
  name: string
  ip: string
  hostname: string
}

interface RuntimeServerConfig {
  serverId: string
  serverIp: string
  domains: {
    main: string
    wildcard: string
  }
}

function sqlStringLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function titleCaseHostname(hostname: string): string {
  return hostname
    .split(".")
    .filter(segment => segment.length > 0)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

export function buildTemplateSeedRows(): SeedTemplateRow[] {
  const serverConfig = readRuntimeServerConfig()
  return DEPLOYMENT_TEMPLATES.map(template => {
    const sourcePath = `${PATHS.TEMPLATES_ROOT}/${template.internalHostname}`

    if (!existsSync(sourcePath)) {
      throw new Error(`[E2E template seed] Missing runtime template directory for ${template.id}: ${sourcePath}`)
    }

    return {
      templateId: template.id,
      name: template.name,
      description: template.description,
      sourcePath,
      previewUrl: `https://${getDeploymentTemplatePublicHostname(template, serverConfig.domains.wildcard)}`,
    }
  })
}

function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`[E2E template seed] ${field} is required for TEST_ENV=staging`)
  }

  return value.trim()
}

function readRuntimeServerConfig(): RuntimeServerConfig {
  const configPath = process.env.SERVER_CONFIG_PATH
  if (!configPath) {
    throw new Error("[E2E template seed] SERVER_CONFIG_PATH is required for TEST_ENV=staging")
  }

  if (!existsSync(configPath)) {
    throw new Error(`[E2E template seed] Server config not found: ${configPath}`)
  }

  const raw: unknown = JSON.parse(readFileSync(configPath, "utf8"))
  if (!isRecord(raw)) {
    throw new Error("[E2E template seed] Server config must be a JSON object")
  }

  const domains = raw.domains
  if (!isRecord(domains)) {
    throw new Error("[E2E template seed] server-config domains.main is required")
  }

  return {
    serverId: assertNonEmptyString(raw.serverId, "server-config serverId"),
    serverIp: assertNonEmptyString(raw.serverIp, "server-config serverIp"),
    domains: {
      main: assertNonEmptyString(domains.main, "server-config domains.main"),
      wildcard: assertNonEmptyString(domains.wildcard, "server-config domains.wildcard"),
    },
  }
}

export function buildServerSeedRow(): SeedServerRow {
  const serverConfig = readRuntimeServerConfig()
  const serverId = assertNonEmptyString(serverConfig.serverId, "server-config serverId")
  const hostname = assertNonEmptyString(serverConfig.domains.main, "server-config domains.main")
  const ip = assertNonEmptyString(serverConfig.serverIp, "server-config serverIp")

  return {
    serverId,
    name: titleCaseHostname(hostname),
    ip,
    hostname,
  }
}

export function buildTemplateSeedSql(rows: readonly SeedTemplateRow[], server: SeedServerRow): string {
  if (rows.length === 0) {
    throw new Error("[E2E template seed] No template rows to seed")
  }

  const valuesSql = rows
    .map(row =>
      [
        sqlStringLiteral(row.templateId),
        sqlStringLiteral(row.name),
        sqlStringLiteral(row.description),
        sqlStringLiteral(row.sourcePath),
        sqlStringLiteral(row.previewUrl),
        "NULL",
        "0",
        "TRUE",
        "NULL",
      ].join(", "),
    )
    .map(valueSql => `  (${valueSql})`)
    .join(",\n")

  const expectedTemplateIds = rows.map(row => sqlStringLiteral(row.templateId)).join(", ")

  return [
    "BEGIN;",
    "INSERT INTO app.servers (server_id, name, ip, hostname)",
    "VALUES (",
    `  ${sqlStringLiteral(server.serverId)},`,
    `  ${sqlStringLiteral(server.name)},`,
    `  ${sqlStringLiteral(server.ip)},`,
    `  ${sqlStringLiteral(server.hostname)}`,
    ")",
    "ON CONFLICT (server_id) DO UPDATE",
    "SET",
    "  name = EXCLUDED.name,",
    "  ip = EXCLUDED.ip,",
    "  hostname = EXCLUDED.hostname;",
    "INSERT INTO app.templates (",
    "  template_id,",
    "  name,",
    "  description,",
    "  source_path,",
    "  preview_url,",
    "  image_url,",
    "  deploy_count,",
    "  is_active,",
    "  ai_description",
    ") VALUES",
    valuesSql,
    "ON CONFLICT (template_id) DO UPDATE",
    "SET",
    "  name = EXCLUDED.name,",
    "  description = EXCLUDED.description,",
    "  source_path = EXCLUDED.source_path,",
    "  preview_url = EXCLUDED.preview_url,",
    "  image_url = EXCLUDED.image_url,",
    "  is_active = EXCLUDED.is_active;",
    "DO $$",
    "DECLARE",
    "  seeded_count integer;",
    "  seeded_server_count integer;",
    "BEGIN",
    `  SELECT COUNT(*) INTO seeded_count FROM app.templates WHERE template_id IN (${expectedTemplateIds}) AND is_active = TRUE;`,
    `  IF seeded_count <> ${rows.length} THEN`,
    `    RAISE EXCEPTION 'Expected ${rows.length} active templates after seed, found %', seeded_count;`,
    "  END IF;",
    `  SELECT COUNT(*) INTO seeded_server_count FROM app.servers WHERE server_id = ${sqlStringLiteral(server.serverId)};`,
    "  IF seeded_server_count <> 1 THEN",
    "    RAISE EXCEPTION 'Expected current server row to exist after seed, found %', seeded_server_count;",
    "  END IF;",
    "END $$;",
    "COMMIT;",
  ].join("\n")
}

export function seedTemplatesForE2E(testEnv: TestEnv): void {
  if (testEnv !== "staging") {
    return
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error("[E2E template seed] DATABASE_URL is required for TEST_ENV=staging")
  }

  const rows = buildTemplateSeedRows()
  const server = buildServerSeedRow()
  const sql = buildTemplateSeedSql(rows, server)
  const tempDir = mkdtempSync(join(tmpdir(), "alive-e2e-template-seed-"))
  const tempFile = join(tempDir, "seed-templates.sql")

  writeFileSync(tempFile, `${sql}\n`, "utf8")

  try {
    const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", tempFile], {
      encoding: "utf8",
    })

    if (result.status !== 0) {
      const stderr = result.stderr.trim()
      const stdout = result.stdout.trim()
      const detail = stderr || stdout || `psql exited with status ${result.status ?? "unknown"}`
      throw new Error(`[E2E template seed] ${detail}`)
    }

    console.log(
      `🌱 [Global Setup] Seeded ${rows.length} deployment templates and server ${server.serverId} into staging DB`,
    )
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}
