#!/usr/bin/env bun
/**
 * Migrate domain-passwords.json to database
 * Features: dry-run, transactions, validation, duplicate detection
 *
 * Usage:
 *   bun scripts/migrate-to-database.ts --dry-run  # Test first
 *   bun scripts/migrate-to-database.ts            # Run for real
 */

import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import { db, isDatabaseHealthy, rawDb } from "../apps/web/lib/db/client"
import { userWorkspaces, users, workspaces } from "../apps/web/lib/db/schema"
import { loadDomainPasswords } from "../apps/web/types/guards/api"
import type { DomainPasswords } from "../apps/web/types/domain"

// ============================================================================
// CONFIGURATION
// ============================================================================

const isDryRun = process.argv.includes("--dry-run")
const DATABASE_PATH = process.env.DATABASE_PATH || "/var/lib/claude-bridge/database.sqlite"
const DOMAIN_PASSWORDS_PATH =
	process.env.DOMAIN_PASSWORDS_PATH || "/var/lib/claude-bridge/domain-passwords.json"

// ============================================================================
// VALIDATION
// ============================================================================

interface ValidationError {
	domain: string
	error: string
}

interface MigrationPlan {
	users: Map<
		string,
		{
			id: string
			email: string
			passwordHash: string
			name: string
			createdAt: Date
			workspaces: string[]
		}
	>
	workspaces: Map<
		string,
		{
			id: string
			domain: string
			port: number
			credits: number
			createdAt: Date
			ownerEmail: string
		}
	>
	errors: ValidationError[]
}

function validateEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	return emailRegex.test(email)
}

function generateEmailFromDomain(domain: string): string {
	// Convert domain to email-safe format
	// demo.goalive.nl → demo-goalive-nl@bridge.local
	return `${domain.replace(/\./g, "-")}@bridge.local`
}

function createMigrationPlan(domainPasswords: DomainPasswords): MigrationPlan {
	const plan: MigrationPlan = {
		users: new Map(),
		workspaces: new Map(),
		errors: [],
	}

	const emailToWorkspaces = new Map<string, string[]>()

	// First pass: collect all domains and their emails
	for (const [domain, config] of Object.entries(domainPasswords)) {
		// Validate required fields
		if (!config.passwordHash) {
			plan.errors.push({ domain, error: "Missing passwordHash" })
			continue
		}
		if (!config.port) {
			plan.errors.push({ domain, error: "Missing port" })
			continue
		}

		// Determine email
		let email: string
		if (config.email && validateEmail(config.email)) {
			email = config.email
		} else {
			email = generateEmailFromDomain(domain)
		}

		// Track workspaces per email (for conflict detection)
		if (!emailToWorkspaces.has(email)) {
			emailToWorkspaces.set(email, [])
		}
		emailToWorkspaces.get(email)?.push(domain)

		// Create workspace entry
		const workspaceId = config.tenantId || randomUUID()
		const createdAt = config.createdAt ? new Date(config.createdAt) : new Date()

		plan.workspaces.set(domain, {
			id: workspaceId,
			domain,
			port: config.port,
			credits: config.credits ?? 200,
			createdAt,
			ownerEmail: email,
		})
	}

	// Second pass: handle email conflicts
	for (const [email, domains] of emailToWorkspaces.entries()) {
		if (domains.length === 1) {
			// No conflict - single workspace per email
			const domain = domains[0]
			const workspace = plan.workspaces.get(domain)
			const config = domainPasswords[domain]

			if (workspace && config) {
				const userId = randomUUID()
				plan.users.set(email, {
					id: userId,
					email,
					passwordHash: config.passwordHash,
					name: config.email ? domain : domain, // Use domain as name
					createdAt: workspace.createdAt,
					workspaces: [domain],
				})
			}
		} else {
			// Conflict - multiple workspaces with same email
			// Strategy: Create separate user for each, add +suffix to email
			for (let i = 0; i < domains.length; i++) {
				const domain = domains[i]
				const workspace = plan.workspaces.get(domain)
				const config = domainPasswords[domain]

				if (!workspace || !config) continue

				const uniqueEmail = i === 0 ? email : `${email.replace("@", `+${domain.replace(/\./g, "-")}@`)}`
				const userId = randomUUID()

				plan.users.set(uniqueEmail, {
					id: userId,
					email: uniqueEmail,
					passwordHash: config.passwordHash,
					name: domain,
					createdAt: workspace.createdAt,
					workspaces: [domain],
				})

				// Update workspace owner email reference
				workspace.ownerEmail = uniqueEmail
			}
		}
	}

	return plan
}

// ============================================================================
// MIGRATION
// ============================================================================

function printMigrationPlan(plan: MigrationPlan): void {
	console.log("\n📊 Migration Plan")
	console.log("=".repeat(60))
	console.log(`Users to create:      ${plan.users.size}`)
	console.log(`Workspaces to create: ${plan.workspaces.size}`)
	console.log(`User-workspace links: ${plan.workspaces.size}`) // 1:1 for now
	console.log(`Validation errors:    ${plan.errors.length}`)

	if (plan.errors.length > 0) {
		console.log("\n⚠️  Validation Errors:")
		for (const error of plan.errors) {
			console.log(`  - ${error.domain}: ${error.error}`)
		}
	}

	console.log("\n📧 User Accounts:")
	for (const [email, user] of plan.users.entries()) {
		console.log(`  ${email}`)
		console.log(`    ├─ Workspaces: ${user.workspaces.join(", ")}`)
		console.log(`    └─ Created: ${user.createdAt.toISOString()}`)
	}

	console.log("\n🌐 Workspaces:")
	for (const [domain, workspace] of plan.workspaces.entries()) {
		console.log(`  ${domain}`)
		console.log(`    ├─ Port: ${workspace.port}`)
		console.log(`    ├─ Credits: ${workspace.credits}`)
		console.log(`    ├─ Owner: ${workspace.ownerEmail}`)
		console.log(`    └─ ID: ${workspace.id}`)
	}
}

async function executeMigration(plan: MigrationPlan): Promise<void> {
	let usersCreated = 0
	let workspacesCreated = 0
	let linksCreated = 0

	// Use transaction for atomicity
	rawDb.exec("BEGIN TRANSACTION")

	try {
		// Insert users
		const insertUser = rawDb.query(`
      INSERT INTO users (id, email, password_hash, name, created_at, updated_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
    `)

		for (const [email, user] of plan.users.entries()) {
			insertUser.run(
				user.id,
				user.email,
				user.passwordHash,
				user.name,
				Math.floor(user.createdAt.getTime() / 1000), // Convert to Unix timestamp
				Math.floor(Date.now() / 1000),
			)
			usersCreated++
			console.log(`✓ User created: ${email}`)
		}

		// Insert workspaces
		const insertWorkspace = rawDb.query(`
      INSERT INTO workspaces (id, domain, port, credits, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

		for (const [domain, workspace] of plan.workspaces.entries()) {
			insertWorkspace.run(
				workspace.id,
				workspace.domain,
				workspace.port,
				workspace.credits,
				Math.floor(workspace.createdAt.getTime() / 1000),
				Math.floor(Date.now() / 1000),
			)
			workspacesCreated++
			console.log(`✓ Workspace created: ${domain}`)
		}

		// Insert user-workspace links
		const insertLink = rawDb.query(`
      INSERT INTO user_workspaces (id, user_id, workspace_id, role, created_at)
      VALUES (?, ?, ?, 'owner', ?)
    `)

		for (const [domain, workspace] of plan.workspaces.entries()) {
			const ownerUser = plan.users.get(workspace.ownerEmail)
			if (!ownerUser) {
				throw new Error(`Owner user not found for workspace ${domain}`)
			}

			insertLink.run(
				randomUUID(),
				ownerUser.id,
				workspace.id,
				Math.floor(Date.now() / 1000),
			)
			linksCreated++
			console.log(`✓ Link created: ${workspace.ownerEmail} → ${domain} (owner)`)
		}

		// Commit transaction
		rawDb.exec("COMMIT")
	} catch (error) {
		// Rollback on error
		rawDb.exec("ROLLBACK")
		throw error
	}

	console.log("\n✅ Migration completed successfully!")
	console.log(`  Users created: ${usersCreated}`)
	console.log(`  Workspaces created: ${workspacesCreated}`)
	console.log(`  Links created: ${linksCreated}`)
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
	console.log("🚀 Database Migration Tool")
	console.log("=".repeat(60))
	console.log(`Mode: ${isDryRun ? "DRY RUN (no changes)" : "LIVE (will modify database)"}`)
	console.log(`Database: ${DATABASE_PATH}`)
	console.log(`Source: ${DOMAIN_PASSWORDS_PATH}`)

	// Pre-flight checks
	console.log("\n🔍 Pre-flight checks...")

	// Check database exists
	if (!existsSync(DATABASE_PATH)) {
		console.error(`❌ Database not found: ${DATABASE_PATH}`)
		console.error("Run initialization script first: bun scripts/init-database.ts")
		process.exit(1)
	}

	// Check database is healthy
	if (!isDatabaseHealthy()) {
		console.error("❌ Database health check failed")
		process.exit(1)
	}
	console.log("✓ Database is healthy")

	// Check domain-passwords.json exists
	if (!existsSync(DOMAIN_PASSWORDS_PATH)) {
		console.error(`❌ Domain passwords file not found: ${DOMAIN_PASSWORDS_PATH}`)
		process.exit(1)
	}
	console.log("✓ Domain passwords file exists")

	// Check if database already has data
	const userCount = rawDb.query("SELECT COUNT(*) as count FROM users").get() as {
		count: number
	}
	if (userCount.count > 0) {
		console.error(`❌ Database already contains ${userCount.count} users`)
		console.error("This script should only run on a fresh database")
		console.error("If you want to re-migrate, delete the database first:")
		console.error(`rm ${DATABASE_PATH}`)
		console.error(`bun scripts/init-database.ts`)
		process.exit(1)
	}
	console.log("✓ Database is empty (ready for migration)")

	// Load domain passwords
	console.log("\n📂 Loading domain passwords...")
	const domainPasswords = loadDomainPasswords()
	const workspaceCount = Object.keys(domainPasswords).length
	console.log(`✓ Loaded ${workspaceCount} workspaces`)

	if (workspaceCount === 0) {
		console.error("❌ No workspaces found in domain-passwords.json")
		process.exit(1)
	}

	// Create migration plan
	console.log("\n📋 Creating migration plan...")
	const plan = createMigrationPlan(domainPasswords)

	if (plan.errors.length > 0) {
		console.error(`\n❌ Found ${plan.errors.length} validation errors`)
		console.error("Fix these errors in domain-passwords.json and try again")
		process.exit(1)
	}

	// Print plan
	printMigrationPlan(plan)

	// Dry run - stop here
	if (isDryRun) {
		console.log("\n" + "=".repeat(60))
		console.log("✅ DRY RUN COMPLETE - No changes were made")
		console.log("\nTo apply these changes, run:")
		console.log("bun scripts/migrate-to-database.ts")
		process.exit(0)
	}

	// Confirm before proceeding
	console.log("\n" + "=".repeat(60))
	console.log("⚠️  WARNING: This will modify the database")
	console.log("Proceeding in 3 seconds... (Ctrl+C to cancel)")
	await new Promise((resolve) => setTimeout(resolve, 3000))

	// Execute migration
	console.log("\n🔄 Executing migration...")
	try {
		await executeMigration(plan)
	} catch (error) {
		console.error("\n❌ Migration failed:")
		console.error(error)
		console.error("\nDatabase may be in inconsistent state")
		console.error("Recommendation: Delete database and start over")
		process.exit(1)
	}

	// Final verification
	console.log("\n🔍 Verifying migration...")
	const finalUserCount = rawDb.query("SELECT COUNT(*) as count FROM users").get() as {
		count: number
	}
	const finalWorkspaceCount = rawDb.query("SELECT COUNT(*) as count FROM workspaces").get() as {
		count: number
	}
	const finalLinkCount = rawDb.query("SELECT COUNT(*) as count FROM user_workspaces").get() as {
		count: number
	}

	console.log(`Users in database: ${finalUserCount.count} (expected: ${plan.users.size})`)
	console.log(
		`Workspaces in database: ${finalWorkspaceCount.count} (expected: ${plan.workspaces.size})`,
	)
	console.log(
		`Links in database: ${finalLinkCount.count} (expected: ${plan.workspaces.size})`,
	)

	if (
		finalUserCount.count === plan.users.size &&
		finalWorkspaceCount.count === plan.workspaces.size &&
		finalLinkCount.count === plan.workspaces.size
	) {
		console.log("\n✅ Migration verified successfully!")
		console.log("\nNext steps:")
		console.log("1. Test login with an email:")
		console.log("   bun scripts/test-login.ts demo-goalive-nl@bridge.local")
		console.log("2. Deploy new authentication code")
		console.log("3. Restart the service")
	} else {
		console.error("\n❌ Verification failed - counts don't match")
		process.exit(1)
	}
}

main().catch((error) => {
	console.error("Fatal error:", error)
	process.exit(1)
})
