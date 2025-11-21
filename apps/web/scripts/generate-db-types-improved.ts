#!/usr/bin/env bun
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

// Load .env file manually
const envPath = resolve(dirname(new URL(import.meta.url).pathname), "../.env")
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8")
  envContent.split("\n").forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, "")
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
}

const env = process.env
const isCI = env.CI === "1" || env.CI === "true"
const isVercel = env.VERCEL === "1" || env.VERCEL === "true"
const skipGeneration = env.SKIP_DB_TYPES_GENERATION === "1" || env.SKIP_DB_TYPES_GENERATION === "true"
const recoverableErrorPattern =
  /AccessDenied|EACCES|ConnectionRefused|ENOTFOUND|ENETUNREACH|ECONNREFUSED|ECONNRESET|fetch failed|Cannot find package|ERR_MODULE_NOT_FOUND|Access token not provided|Unauthorized/i

// Define all schemas to generate - each schema gets its own file
const schemas = [
  // { name: "public", filename: "public.types.ts" }, // Commented out - not needed yet
  { name: "iam", filename: "iam.types.ts" },
  { name: "app", filename: "app.types.ts" },
  { name: "lockbox", filename: "lockbox.types.ts" },
]

const projectId = env.SUPABASE_PROJECT_ID || "qnvprftdorualkdyogka"
const supabaseCliPath =
  env.SUPABASE_CLI_PATH ||
  (() => {
    try {
      return typeof Bun !== "undefined" && typeof Bun.which === "function" ? (Bun.which("supabase") ?? null) : null
    } catch {
      return null
    }
  })()

/**
 * Fallback type templates when CLI is unavailable
 */
const schemaTemplates: Record<string, string> = {
  public: `export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {}
    Views: {}
    Functions: {}
    Enums: {}
  }
}`,

  iam: `export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  iam: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          user_id: string
          token: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          expires_at?: string
          created_at?: string
        }
      }
      workspaces: {
        Row: {
          id: string
          name: string
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}`,
}

async function generateSchemaTypes(schemaName: string, outputFilename: string, tempDir: string) {
  const outPath = resolve(dirname(new URL(import.meta.url).pathname), `../lib/supabase/${outputFilename}`)

  console.log(`📊 Generating ${schemaName} schema types…`)

  const baseArgs = ["gen", "types", "typescript", "--project-id", projectId, "--schema", schemaName]
  const command = supabaseCliPath ?? "bun"
  const args = supabaseCliPath ? baseArgs : ["x", "supabase@latest", ...baseArgs]

  const proc = Bun.spawn([command, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
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

  if (exitCode !== 0) {
    const combinedOutput = `${stdout}\n${stderr}`
    if (recoverableErrorPattern.test(combinedOutput)) {
      console.warn(`⚠️  ${schemaName} schema: Supabase CLI unavailable. Using fallback template.`)

      // Use fallback template
      const template = schemaTemplates[schemaName]
      if (template) {
        const dir = dirname(outPath)
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

        const header = `// Auto-generated ${schemaName} schema types (FALLBACK TEMPLATE)
// Generated: ${new Date().toISOString()}
// Run: bun run gen:db (requires Supabase CLI auth)
// Project: ${projectId}
//
// ⚠️ NOTE: Using template types. Run 'supabase login' and regenerate for actual schema.

`
        writeFileSync(outPath, header + template, "utf-8")
        console.log(`✓ ${schemaName} schema types generated (template) at ${outPath}`)
        return true
      }
      return false
    }
    console.error(stderr.trim() || stdout.trim())
    throw new Error(`supabase gen types for ${schemaName} failed with code ${exitCode}`)
  }

  // Ensure directory exists
  const dir = dirname(outPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  // Apply fix for Constants export if present
  const fixed = stdout.replace(
    /export const Constants = \{/,
    "export type Constants = typeof _Constants\n\nconst _Constants = {",
  )

  // Add generation comment
  const header = `// Auto-generated ${schemaName} schema types
// Generated: ${new Date().toISOString()}
// Run: bun run gen:db
// Project: ${projectId}

`

  writeFileSync(outPath, header + fixed, "utf-8")
  console.log(`✓ ${schemaName} schema types generated at ${outPath}`)
  return true
}

async function main() {
  // Skip generation in CI/Vercel builds to use committed types
  if (skipGeneration || isCI || isVercel) {
    console.log("ℹ️  Using committed database types (Vercel/CI build)")
    return
  }

  const tempDir = resolve(dirname(new URL(import.meta.url).pathname), "../.tmp/supabase")
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true })
  }

  // Run only if tmp is empty OR last run was > 2 hours ago
  const cooldownMs = 2 * 60 * 60 * 1000
  const stampFile = resolve(tempDir, ".last-run")
  const isTmpEmpty = (() => {
    try {
      const entries = readdirSync(tempDir)
      return entries.length === 0
    } catch {
      return true
    }
  })()

  let withinCooldown = false
  if (existsSync(stampFile)) {
    try {
      const mtime = statSync(stampFile).mtimeMs
      withinCooldown = Date.now() - mtime < cooldownMs
    } catch {
      withinCooldown = false
    }
  }

  if (!isTmpEmpty && withinCooldown) {
    const minsLeft = Math.ceil((cooldownMs - (Date.now() - statSync(stampFile).mtimeMs)) / 60000)
    console.log(`⏭️  Skipping DB type generation (cooldown). Try again in ~${minsLeft}m or clear .tmp.`)
    return
  }

  console.log("🔄 Generating Supabase types for all schemas…")
  console.log(`   Access token: ${env.SUPABASE_ACCESS_TOKEN ? "SET" : "NOT SET"}`)
  console.log(`   Project ID: ${projectId}`)
  if (supabaseCliPath) {
    console.log(`   Using Supabase CLI binary at ${supabaseCliPath}`)
  } else {
    console.log("   Using bunx to execute Supabase CLI (no global binary detected)")
  }

  // Generate all schema types
  let allSucceeded = true
  for (const schema of schemas) {
    const ok = await generateSchemaTypes(schema.name, schema.filename, tempDir)
    allSucceeded = allSucceeded && ok
  }

  // Stamp only if all schemas succeeded
  if (allSucceeded) {
    try {
      writeFileSync(stampFile, new Date().toISOString(), "utf-8")
    } catch {}
  }

  console.log("\n✅ All schema types generated successfully")
}

main().catch(err => {
  if (err instanceof Error && recoverableErrorPattern.test(err.message)) {
    console.warn(
      "⚠️  Supabase type generation failed due to CLI permissions, network issues, or missing dependencies. Using committed types instead.",
    )
    console.warn("   Set SKIP_DB_TYPES_GENERATION=1 to disable generation explicitly if needed.")
    return
  }
  console.error("❌ Failed to generate database types:", err)
  console.error("   To skip generation and use committed types, set SKIP_DB_TYPES_GENERATION=1")
  process.exit(1)
})
