#!/usr/bin/env bun
/**
 * Initialize database - create tables and indexes
 * Run this before migration: bun scripts/init-database.ts
 */

import { existsSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { db, isDatabaseHealthy, rawDb } from "../apps/web/lib/db/client"
import { sessions, userWorkspaces, users, workspaces } from "../apps/web/lib/db/schema"

const DATABASE_PATH = process.env.DATABASE_PATH || "/var/lib/claude-bridge/database.sqlite"

console.log("🗄️  Database Initialization")
console.log("=" .repeat(60))
console.log(`Database path: ${DATABASE_PATH}`)

// Ensure directory exists
const dbDir = dirname(DATABASE_PATH)
if (!existsSync(dbDir)) {
	console.log(`Creating directory: ${dbDir}`)
	mkdirSync(dbDir, { recursive: true })
}

// Check if tables already exist
try {
	const tablesExist = rawDb
		.query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
		.get()
	if (tablesExist) {
		console.log("⚠️  Database tables already exist")
		console.log("If you want to recreate them, delete the database first:")
		console.log(`rm ${DATABASE_PATH}*`)
		process.exit(1)
	}
} catch (error) {
	// Database doesn't exist yet, which is fine
}

console.log("\n📋 Creating database schema...")

try {
	// Create users table
	rawDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_login_at INTEGER
    )
  `)
	console.log("✓ Created table: users")

	// Create workspaces table
	rawDb.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL UNIQUE,
      port INTEGER NOT NULL,
      credits INTEGER NOT NULL DEFAULT 200,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
	console.log("✓ Created table: workspaces")

	// Create user_workspaces junction table
	rawDb.exec(`
    CREATE TABLE IF NOT EXISTS user_workspaces (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner', 'member', 'viewer')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(user_id, workspace_id)
    )
  `)
	console.log("✓ Created table: user_workspaces")

	// Create sessions table
	rawDb.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      conversation_id TEXT NOT NULL,
      sdk_session_id TEXT NOT NULL,
      last_activity INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      UNIQUE(user_id, workspace_id, conversation_id)
    )
  `)
	console.log("✓ Created table: sessions")

	console.log("\n📊 Creating indexes...")

	// Indexes for user_workspaces
	rawDb.exec("CREATE INDEX IF NOT EXISTS user_workspaces_user_idx ON user_workspaces(user_id)")
	rawDb.exec(
		"CREATE INDEX IF NOT EXISTS user_workspaces_workspace_idx ON user_workspaces(workspace_id)",
	)
	console.log("✓ Created indexes on: user_workspaces")

	// Indexes for sessions
	rawDb.exec("CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at)")
	rawDb.exec("CREATE INDEX IF NOT EXISTS sessions_conversation_idx ON sessions(conversation_id)")
	console.log("✓ Created indexes on: sessions")

	// Verify database health
	if (!isDatabaseHealthy()) {
		throw new Error("Database health check failed after initialization")
	}

	// Count tables
	const tables = rawDb
		.prepare(
			`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `,
		)
		.all() as Array<{ name: string }>

	console.log("\n✅ Database initialized successfully!")
	console.log(`Tables created: ${tables.map((t) => t.name).join(", ")}`)
	console.log("\nNext step: Run migration script")
	console.log("bun scripts/migrate-to-database.ts --dry-run")
} catch (error) {
	console.error("\n❌ Database initialization failed:")
	console.error(error)
	process.exit(1)
}
