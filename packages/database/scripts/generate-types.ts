#!/usr/bin/env bun
/**
 * Generate database schema types from Supabase
 *
 * This script generates TypeScript types for all database schemas.
 * Run manually when the database schema changes: `bun run gen:types`
 *
 * Prerequisites:
 * - Supabase CLI installed (`bun x supabase` or `npm i -g supabase`)
 * - SUPABASE_PROJECT_ID env var or use default
 *
 * Note: Generated files are committed to git. Do NOT include timestamps
 * to avoid unnecessary diffs when types haven't actually changed.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

function loadEnvFile(filePath: string, override = false) {
  if (!existsSync(filePath)) {
    return
  }

  const envContent = readFileSync(filePath, "utf-8")
  envContent.split("\n").forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (!match) {
      return
    }

    const key = match[1].trim()
    const value = match[2].trim().replace(/^["']|["']$/g, "")
    if (override || !process.env[key]) {
      process.env[key] = value
    }
  })
}

// Load environment variables from apps/web/.env then .env.production (production overrides .env)
const scriptDir = dirname(fileURLToPath(import.meta.url))
loadEnvFile(resolve(scriptDir, "../../../apps/web/.env"))
loadEnvFile(resolve(scriptDir, "../../../apps/web/.env.production"), true)

const projectId = process.env.SUPABASE_PROJECT_ID
const databasePassword = process.env.DATABASE_PASSWORD

// Inject password into DATABASE_URL if it's provided separately.
// supabase gen types --db-url does NOT respect PGPASSWORD env var.
const databaseUrl = (() => {
  const raw = process.env.DATABASE_URL
  if (!raw || !databasePassword) return raw
  try {
    const url = new URL(raw)
    if (!url.password) {
      url.password = databasePassword
      return url.toString()
    }
  } catch {
    // Not a valid URL, return as-is
  }
  return raw
})()

if (projectId === undefined && databaseUrl === undefined) {
  console.error("❌ Error: SUPABASE_PROJECT_ID or DATABASE_URL is required")
  console.error("")
  console.error("Set one of the existing deploy credentials in your environment:")
  console.error("  export SUPABASE_PROJECT_ID=your_project_id")
  console.error("  export DATABASE_URL=postgresql://...")
  console.error("")
  console.error("The generator refuses to guess a database target.")
  process.exit(1)
}

const supabaseCliPath = (() => {
  try {
    return typeof Bun !== "undefined" && typeof Bun.which === "function" ? (Bun.which("supabase") ?? null) : null
  } catch {
    return null
  }
})()

const bunxPath = (() => {
  try {
    return typeof Bun !== "undefined" && typeof Bun.which === "function" ? (Bun.which("bunx") ?? null) : null
  } catch {
    return null
  }
})()

const outputDir = resolve(scriptDir, "../src")
const tempDir = resolve(scriptDir, "../.tmp")

async function generateTypes() {
  console.log("Generating database schema types...")
  console.log(projectId !== undefined ? `Project ID: ${projectId}` : "Project ID: <not set>")
  console.log(databaseUrl !== undefined ? "Type source: DATABASE_URL" : "Type source: SUPABASE_PROJECT_ID")

  // Ensure temp directory exists
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true })
  }

  try {
    // Generate types for all schemas
    const schemas = ["lockbox", "integrations", "iam", "public", "app", "deploy"]
    const generatedSchemas: string[] = []

    const runSupabaseGen = async (schema: string) => {
      const preferredMode = databaseUrl !== undefined ? "db-url" : "project-id"
      const modes = preferredMode === "db-url" ? ["db-url", "project-id"] : ["project-id", "db-url"]

      for (const mode of modes) {
        if (mode === "project-id" && projectId === undefined) {
          continue
        }
        if (mode === "db-url" && databaseUrl === undefined) {
          continue
        }

        const baseArgs =
          mode === "db-url"
            ? ["gen", "types", "typescript", "--db-url", databaseUrl, "--schema", schema]
            : ["gen", "types", "typescript", "--project-id", projectId, "--schema", schema]

        const command = supabaseCliPath ?? bunxPath ?? "bunx"
        const args = supabaseCliPath ? baseArgs : ["supabase@latest", ...baseArgs]

        const proc = Bun.spawn([command, ...args], {
          stdout: "pipe",
          stderr: "pipe",
          env: {
            ...process.env,
            ...(databasePassword !== undefined ? { PGPASSWORD: databasePassword } : {}),
            TMPDIR: tempDir,
            TEMP: tempDir,
            TMP: tempDir,
            BUN_INSTALL_CACHE: tempDir,
            BUN_INSTALL_TMPDIR: tempDir,
            XDG_CACHE_HOME: tempDir,
          },
        })

        const stdout = await new Response(proc.stdout).text()
        const stderr = proc.stderr ? await new Response(proc.stderr).text() : ""
        const exitCode = await proc.exited

        if (exitCode === 0) {
          return { stdout, stderr, mode, exitCode }
        }

        const combined = `${stderr}\n${stdout}`
        const canRetryWithNextMode =
          mode === "project-id" &&
          databaseUrl !== undefined &&
          (combined.includes("Unauthorized") || combined.includes("failed to retrieve generated types"))

        if (!canRetryWithNextMode) {
          return { stdout, stderr, mode, exitCode }
        }

        console.warn(`  ${schema}: project-id generation unauthorized, retrying with DATABASE_URL`)
      }

      return { stdout: "", stderr: "No supported type generation mode available", mode: "none", exitCode: 1 }
    }

    for (const schema of schemas) {
      console.log(`  Generating types for ${schema} schema...`)

      const { stdout, stderr, exitCode } = await runSupabaseGen(schema)

      if (exitCode !== 0) {
        // If schema doesn't exist, continue with others
        if (stderr.includes("does not exist")) {
          console.log(`  Note: ${schema} schema not found in database, skipping...`)
          continue
        }
        console.error(`Failed to generate types for ${schema} schema:`)
        console.error(stderr.trim() || stdout.trim())
        process.exit(1)
      }

      // Post-process: Fix DefaultSchema to use the actual schema name
      // Supabase CLI always generates with "public" but schema-specific files need their own schema
      let processedOutput = stdout
      if (schema !== "public") {
        processedOutput = processedOutput.replace(
          /type DefaultSchema = DatabaseWithoutInternals\[Extract<keyof Database, "public">\]/g,
          `type DefaultSchema = DatabaseWithoutInternals["${schema}"]`,
        )
      }

      // Write to individual generated file (NO TIMESTAMP to avoid noisy diffs)
      const generatedFilePath = resolve(outputDir, `${schema}.generated.ts`)
      const fileContent = `// Auto-generated ${schema} schema types
// Generated from Supabase database
// DO NOT EDIT MANUALLY - Run 'bun run gen:types' to regenerate
//
// Schema: ${schema}
// Project: ${projectId ?? "DATABASE_URL"}

${processedOutput}
`

      writeFileSync(generatedFilePath, fileContent)
      generatedSchemas.push(schema)
      console.log(`  Written: src/${schema}.generated.ts`)
    }

    // Create the main index.ts file that imports and re-exports
    // (NO TIMESTAMP to avoid noisy diffs)
    const generatedTypeImports = generatedSchemas
      .map(schema => {
        const capitalized = schema.charAt(0).toUpperCase() + schema.slice(1)
        return `import type { Database as ${capitalized}Database } from "./${schema}.generated.js"`
      })
      .join("\n")

    const generatedTypeExports = generatedSchemas
      .map(schema => {
        const capitalized = schema.charAt(0).toUpperCase() + schema.slice(1)
        return `export type { ${capitalized}Database }`
      })
      .join("\n")

    const mainTypesContent = `// Main database types file
// Imports and re-exports generated schema types
// DO NOT EDIT MANUALLY - Run 'bun run gen:types' to regenerate

// Import Database types for renaming
${generatedTypeImports}

// Export generated constants (runtime enum values derived from DB)
${generatedSchemas.includes("app") ? `export { Constants as AppConstants } from "./app.generated.js"` : "// App constants unavailable"}

// Export automation enum types, guards, and runtime sets
export {
  ACTION_TYPES,
  type ActionType,
  EXECUTION_MODES,
  type ExecutionMode,
  isActionType,
  isExecutionMode,
  isJobStatus,
  isRunStatus,
  isSandboxStatus,
  isTriggerType,
  JOB_STATUSES,
  type JobStatus,
  RUN_STATUSES,
  type RunStatus,
  SANDBOX_STATUSES,
  type SandboxStatus,
  type TerminalRunStatus,
  TRIGGER_TYPES,
  type TriggerType,
} from "./automation-enums.js"
${
  generatedSchemas.includes("deploy")
    ? `export { Constants as DeployConstants } from "./deploy.generated.js"
export {
  DEPLOY_ARTIFACT_KIND_DOCKER_IMAGE,
  DEPLOY_ARTIFACT_KINDS,
  DEPLOY_DEPLOYMENT_ACTION_DEPLOY,
  DEPLOY_DEPLOYMENT_ACTION_PROMOTE,
  DEPLOY_DEPLOYMENT_ACTION_ROLLBACK,
  DEPLOY_DEPLOYMENT_ACTIONS,
  DEPLOY_ENVIRONMENT_NAMES,
  DEPLOY_ENVIRONMENT_PRODUCTION,
  DEPLOY_ENVIRONMENT_STAGING,
  DEPLOY_EXECUTOR_BACKENDS,
  DEPLOY_EXECUTOR_DOCKER,
  DEPLOY_GIT_PROVIDER_GITHUB,
  DEPLOY_GIT_PROVIDERS,
  DEPLOY_TASK_STATUS_CANCELLED,
  DEPLOY_TASK_STATUS_FAILED,
  DEPLOY_TASK_STATUS_PENDING,
  DEPLOY_TASK_STATUS_RUNNING,
  DEPLOY_TASK_STATUS_SUCCEEDED,
  DEPLOY_TASK_STATUSES,
  type DeployArtifactKind,
  type DeployDeploymentAction,
  type DeployEnvironmentName,
  type DeployExecutorBackend,
  type DeployGitProvider,
  type DeployTaskStatus,
  isDeployArtifactKind,
  isDeployDeploymentAction,
  isDeployEnvironmentName,
  isDeployExecutorBackend,
  isDeployGitProvider,
  isDeployTaskStatus,
} from "./deploy-enums.js"`
    : "// Deploy enums unavailable"
}

// Export common types from public schema (if available) or lockbox as fallback
${
  generatedSchemas.includes("public")
    ? `export {
  CompositeTypes,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "./public.generated.js"`
    : generatedSchemas.includes("lockbox")
      ? `export {
  CompositeTypes,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "./lockbox.generated.js"`
      : "// No common types to export"
}

// Re-export with schema-specific names
${generatedTypeExports}

// Re-export the main Database type for backward compatibility
${
  generatedSchemas.includes("public") || generatedSchemas.includes("lockbox")
    ? `export type Database = ${generatedSchemas.includes("public") ? "PublicDatabase" : "LockboxDatabase"}`
    : `// ERROR: No usable database schema found (expected 'public' or 'lockbox')
// This is a configuration error - check your database setup
export type Database = never`
}

// Export database client creators
export * from "./client.js"

// Export startup verification (schema + server identity)
export {
  checkSchema,
  ensureServerRow,
  formatSchemaFailure,
  formatServerCheckFailure,
  type ServerIdentity,
} from "./seed-check.js"
`

    const mainTypesPath = resolve(outputDir, "index.ts")
    writeFileSync(mainTypesPath, mainTypesContent)

    console.log("\nTypes generated successfully!")
    console.log(`Schemas included: ${generatedSchemas.join(", ")}`)
    console.log("\nGenerated files:")
    generatedSchemas.forEach(schema => {
      console.log(`  - src/${schema}.generated.ts`)
    })
    console.log("  - src/index.ts")
  } catch (error) {
    console.error("Type generation failed:")
    console.error(error)
    process.exit(1)
  }
}

generateTypes()
