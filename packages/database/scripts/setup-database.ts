#!/usr/bin/env bun
/**
 * Database Setup Script for Open Source Users
 *
 * This script helps users set up their own database for Claude Bridge.
 *
 * Usage:
 *   bun run db:setup
 *
 * Options:
 *   --supabase   Set up using Supabase (recommended for beginners)
 *   --local      Set up using local PostgreSQL
 *   --skip-seed  Skip seeding initial data
 *
 * Requirements:
 *   - PostgreSQL 15+ (with pgvector extension recommended)
 *   - DATABASE_URL environment variable set
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"

const scriptDir = dirname(new URL(import.meta.url).pathname)
const rootDir = resolve(scriptDir, "..")
const migrationsDir = resolve(rootDir, "migrations")

// ANSI colors for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
}

function log(message: string) {
  console.log(message)
}

function success(message: string) {
  console.log(`${colors.green}✓${colors.reset} ${message}`)
}

function warn(message: string) {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`)
}

function error(message: string) {
  console.log(`${colors.red}✗${colors.reset} ${message}`)
}

function info(message: string) {
  console.log(`${colors.blue}ℹ${colors.reset} ${message}`)
}

function header(message: string) {
  console.log(`\n${colors.bright}${colors.cyan}${message}${colors.reset}\n`)
}

async function main() {
  const args = process.argv.slice(2)
  const useSupabase = args.includes("--supabase")
  const useLocal = args.includes("--local")
  const skipSeed = args.includes("--skip-seed")

  header("🗄️  Claude Bridge Database Setup")

  log("This script will help you set up the database for Claude Bridge.")
  log("You can use either Supabase (managed) or your own PostgreSQL server.\n")

  // Check for DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    error("DATABASE_URL environment variable is not set.\n")
    log("Please set it in your .env file or environment:\n")
    log("  For Supabase:")
    log(
      "    DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres\n",
    )
    log("  For local PostgreSQL:")
    log("    DATABASE_URL=postgresql://postgres:password@localhost:5432/claude_bridge\n")
    process.exit(1)
  }

  success("DATABASE_URL is set")

  // Test database connection
  info("Testing database connection...")

  try {
    const { Pool } = await import("pg")
    const pool = new Pool({ connectionString: databaseUrl })

    const result = await pool.query("SELECT version()")
    success(`Connected to PostgreSQL: ${result.rows[0].version.split(",")[0]}`)

    // Check for required extensions
    const extensions = await pool.query(`
      SELECT extname FROM pg_extension
      WHERE extname IN ('uuid-ossp', 'pgcrypto')
    `)

    const installedExts = extensions.rows.map((r: any) => r.extname)

    if (!installedExts.includes("uuid-ossp")) {
      warn("Extension uuid-ossp not found. Creating...")
      try {
        await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
        success("Created uuid-ossp extension")
      } catch (e) {
        error("Failed to create uuid-ossp extension. You may need superuser privileges.")
      }
    } else {
      success("Extension uuid-ossp is available")
    }

    if (!installedExts.includes("pgcrypto")) {
      warn("Extension pgcrypto not found. Creating...")
      try {
        await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
        success("Created pgcrypto extension")
      } catch (e) {
        error("Failed to create pgcrypto extension. You may need superuser privileges.")
      }
    } else {
      success("Extension pgcrypto is available")
    }

    await pool.end()
  } catch (e: any) {
    error(`Database connection failed: ${e.message}`)
    log("\nPlease check your DATABASE_URL and make sure PostgreSQL is running.")
    process.exit(1)
  }

  // Check for migrations
  header("📁 Checking Migrations")

  if (!existsSync(migrationsDir)) {
    mkdirSync(migrationsDir, { recursive: true })
    info("Created migrations directory")
  }

  const migrationFiles = existsSync(migrationsDir)
    ? (await import("node:fs/promises")).readdir(migrationsDir).then(files => files.filter(f => f.endsWith(".sql")))
    : []

  if ((await migrationFiles).length === 0) {
    info("No migrations found. Generating from schema...")
    log("\nRun the following command to generate migrations:")
    log(`  ${colors.cyan}cd packages/database && bun run db:generate${colors.reset}`)
    log("\nThen push to your database:")
    log(`  ${colors.cyan}bun run db:push${colors.reset}`)
  } else {
    success(`Found ${(await migrationFiles).length} migration(s)`)
    log("\nTo apply migrations, run:")
    log(`  ${colors.cyan}cd packages/database && bun run db:push${colors.reset}`)
  }

  // Seed data instructions
  if (!skipSeed) {
    header("🌱 Seed Data")

    log("To seed initial data (templates, providers, etc.), you can:")
    log("")
    log("1. Use the Supabase Dashboard SQL editor")
    log("2. Run: psql $DATABASE_URL < packages/database/seed/initial.sql")
    log("")
    log("Seed files to create:")
    log("  - seed/templates.sql     # Site templates")
    log("  - seed/providers.sql     # OAuth providers (linear, gmail, etc.)")
  }

  // Next steps
  header("📋 Next Steps")

  log("1. Generate migrations from schema:")
  log(`   ${colors.cyan}cd packages/database && bun run db:generate${colors.reset}\n`)

  log("2. Push schema to database:")
  log(`   ${colors.cyan}bun run db:push${colors.reset}\n`)

  log("3. (Optional) Open Drizzle Studio to browse your database:")
  log(`   ${colors.cyan}bun run db:studio${colors.reset}\n`)

  log("4. Update your .env file with Supabase keys:")
  log(`   ${colors.dim}SUPABASE_URL=https://[project-ref].supabase.co`)
  log(`   SUPABASE_ANON_KEY=eyJ...`)
  log(`   SUPABASE_SERVICE_ROLE_KEY=eyJ...${colors.reset}\n`)

  header("📚 Documentation")
  log("For detailed setup instructions, see:")
  log("  docs/database/SETUP.md")
  log("  docs/database/MIGRATIONS.md")
  log("  docs/database/SUPABASE.md")

  log("")
  success("Setup complete!")
}

main().catch(e => {
  error(`Setup failed: ${e.message}`)
  process.exit(1)
})
