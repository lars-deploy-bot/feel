#!/usr/bin/env bun
/**
 * Verify database migration completed successfully
 * Checks data integrity, relationships, and constraints
 */

import { db, isDatabaseHealthy, rawDb } from "../apps/web/lib/db/client"

interface VerificationResult {
	passed: boolean
	errors: string[]
	warnings: string[]
}

async function verify(): Promise<VerificationResult> {
	const result: VerificationResult = {
		passed: true,
		errors: [],
		warnings: [],
	}

	console.log("🔍 Verifying Database Migration")
	console.log("=".repeat(60))

	// 1. Database health
	console.log("\n1. Database Health")
	if (!isDatabaseHealthy()) {
		result.errors.push("Database health check failed")
		result.passed = false
		console.log("❌ FAILED")
	} else {
		console.log("✓ Database is healthy")
	}

	// 2. Table counts
	console.log("\n2. Table Counts")
	const userCount = (rawDb.query("SELECT COUNT(*) as count FROM users").get() as { count: number }).count
	const workspaceCount = (
		rawDb.query("SELECT COUNT(*) as count FROM workspaces").get() as { count: number }
	).count
	const linkCount = (
		rawDb.query("SELECT COUNT(*) as count FROM user_workspaces").get() as { count: number }
	).count

	console.log(`Users: ${userCount}`)
	console.log(`Workspaces: ${workspaceCount}`)
	console.log(`User-Workspace Links: ${linkCount}`)

	if (userCount === 0) {
		result.errors.push("No users found in database")
		result.passed = false
	}
	if (workspaceCount === 0) {
		result.errors.push("No workspaces found in database")
		result.passed = false
	}
	if (linkCount === 0) {
		result.errors.push("No user-workspace links found in database")
		result.passed = false
	}

	// 3. Orphaned records
	console.log("\n3. Data Integrity")

	// Check for user_workspaces with invalid user_id
	const orphanedUserLinks = rawDb
		.prepare(
			`
    SELECT uw.id
    FROM user_workspaces uw
    LEFT JOIN users u ON uw.user_id = u.id
    WHERE u.id IS NULL
  `,
		)
		.all()

	if (orphanedUserLinks.length > 0) {
		result.errors.push(`Found ${orphanedUserLinks.length} user_workspaces with invalid user_id`)
		result.passed = false
		console.log(`❌ ${orphanedUserLinks.length} orphaned user links`)
	} else {
		console.log("✓ No orphaned user links")
	}

	// Check for user_workspaces with invalid workspace_id
	const orphanedWorkspaceLinks = rawDb
		.prepare(
			`
    SELECT uw.id
    FROM user_workspaces uw
    LEFT JOIN workspaces w ON uw.workspace_id = w.id
    WHERE w.id IS NULL
  `,
		)
		.all()

	if (orphanedWorkspaceLinks.length > 0) {
		result.errors.push(
			`Found ${orphanedWorkspaceLinks.length} user_workspaces with invalid workspace_id`,
		)
		result.passed = false
		console.log(`❌ ${orphanedWorkspaceLinks.length} orphaned workspace links`)
	} else {
		console.log("✓ No orphaned workspace links")
	}

	// 4. Unique constraints
	console.log("\n4. Unique Constraints")

	// Check for duplicate emails
	const duplicateEmails = rawDb
		.prepare(
			`
    SELECT email, COUNT(*) as count
    FROM users
    GROUP BY email
    HAVING count > 1
  `,
		)
		.all() as Array<{ email: string; count: number }>

	if (duplicateEmails.length > 0) {
		result.errors.push(`Found ${duplicateEmails.length} duplicate emails`)
		result.passed = false
		console.log(`❌ Duplicate emails found:`)
		for (const dup of duplicateEmails) {
			console.log(`  - ${dup.email} (appears ${dup.count} times)`)
		}
	} else {
		console.log("✓ No duplicate emails")
	}

	// Check for duplicate domains
	const duplicateDomains = rawDb
		.prepare(
			`
    SELECT domain, COUNT(*) as count
    FROM workspaces
    GROUP BY domain
    HAVING count > 1
  `,
		)
		.all() as Array<{ domain: string; count: number }>

	if (duplicateDomains.length > 0) {
		result.errors.push(`Found ${duplicateDomains.length} duplicate domains`)
		result.passed = false
		console.log(`❌ Duplicate domains found:`)
		for (const dup of duplicateDomains) {
			console.log(`  - ${dup.domain} (appears ${dup.count} times)`)
		}
	} else {
		console.log("✓ No duplicate domains")
	}

	// 5. Required fields
	console.log("\n5. Required Fields")

	// Check for null emails
	const nullEmails = rawDb.query("SELECT COUNT(*) as count FROM users WHERE email IS NULL").get() as {
		count: number
	}
	if (nullEmails.count > 0) {
		result.errors.push(`Found ${nullEmails.count} users with null email`)
		result.passed = false
		console.log(`❌ ${nullEmails.count} users with null email`)
	} else {
		console.log("✓ All users have email")
	}

	// Check for null password hashes
	const nullPasswords = rawDb
		.prepare("SELECT COUNT(*) as count FROM users WHERE password_hash IS NULL")
		.get() as { count: number }
	if (nullPasswords.count > 0) {
		result.errors.push(`Found ${nullPasswords.count} users with null password_hash`)
		result.passed = false
		console.log(`❌ ${nullPasswords.count} users with null password`)
	} else {
		console.log("✓ All users have password hash")
	}

	// 6. Sample data verification
	console.log("\n6. Sample Data")

	const sampleUser = rawDb
		.prepare(
			`
    SELECT u.email, w.domain, uw.role
    FROM users u
    JOIN user_workspaces uw ON u.id = uw.user_id
    JOIN workspaces w ON uw.workspace_id = w.id
    LIMIT 1
  `,
		)
		.get() as { email: string; domain: string; role: string } | undefined

	if (sampleUser) {
		console.log("Sample relationship:")
		console.log(`  User: ${sampleUser.email}`)
		console.log(`  Workspace: ${sampleUser.domain}`)
		console.log(`  Role: ${sampleUser.role}`)
	} else {
		result.warnings.push("Could not fetch sample user-workspace relationship")
		console.log("⚠️  Could not fetch sample data")
	}

	// 7. Role distribution
	console.log("\n7. Role Distribution")
	const roleCounts = rawDb
		.prepare(
			`
    SELECT role, COUNT(*) as count
    FROM user_workspaces
    GROUP BY role
  `,
		)
		.all() as Array<{ role: string; count: number }>

	for (const roleCount of roleCounts) {
		console.log(`  ${roleCount.role}: ${roleCount.count}`)
	}

	// Most migrations should have all "owner" roles
	const ownerCount = roleCounts.find((r) => r.role === "owner")?.count || 0
	if (ownerCount === 0) {
		result.warnings.push("No workspace owners found")
		console.log("⚠️  No owners found (expected for fresh migration)")
	}

	return result
}

async function main() {
	const result = await verify()

	console.log("\n" + "=".repeat(60))

	if (result.warnings.length > 0) {
		console.log("\n⚠️  Warnings:")
		for (const warning of result.warnings) {
			console.log(`  - ${warning}`)
		}
	}

	if (result.errors.length > 0) {
		console.log("\n❌ Errors:")
		for (const error of result.errors) {
			console.log(`  - ${error}`)
		}
	}

	if (result.passed) {
		console.log("\n✅ Verification PASSED")
		console.log("\nDatabase migration is valid and ready for use")
		process.exit(0)
	} else {
		console.log("\n❌ Verification FAILED")
		console.log("\nDatabase migration has errors that must be fixed")
		process.exit(1)
	}
}

main().catch((error) => {
	console.error("Fatal error:", error)
	process.exit(1)
})
