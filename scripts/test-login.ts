#!/usr/bin/env bun
/**
 * Test login with email from migrated database
 * Usage: bun scripts/test-login.ts email@example.com [password]
 */

import { db, rawDb } from "../apps/web/lib/db/client"
import { verifyPassword } from "../apps/web/types/guards/api"

const email = process.argv[2]
const password = process.argv[3] || "supersecret" // Default password

if (!email) {
	console.error("Usage: bun scripts/test-login.ts email@example.com [password]")
	console.error("\nExample:")
	console.error("  bun scripts/test-login.ts demo-goalive-nl@bridge.local supersecret")
	process.exit(1)
}

async function testLogin() {
	console.log("🔐 Testing Login")
	console.log("=".repeat(60))
	console.log(`Email: ${email}`)
	console.log(`Password: ${"*".repeat(password.length)}`)

	// Find user
	const user = rawDb
		.prepare(
			`
    SELECT id, email, password_hash, name, created_at
    FROM users
    WHERE email = ?
  `,
		)
		.get(email) as
		| {
				id: string
				email: string
				password_hash: string
				name: string
				created_at: number
		  }
		| undefined

	if (!user) {
		console.log("\n❌ User not found")
		console.log("\nAvailable emails:")
		const allUsers = rawDb.query("SELECT email FROM users ORDER BY email").all() as Array<{
			email: string
		}>
		for (const u of allUsers) {
			console.log(`  - ${u.email}`)
		}
		process.exit(1)
	}

	console.log("\n✓ User found")
	console.log(`  ID: ${user.id}`)
	console.log(`  Name: ${user.name}`)
	console.log(`  Created: ${new Date(user.created_at * 1000).toISOString()}`)

	// Verify password
	const isValid = await verifyPassword(password, user.password_hash)

	if (!isValid) {
		console.log("\n❌ Password incorrect")
		process.exit(1)
	}

	console.log("\n✓ Password correct")

	// Get user's workspaces
	const workspaces = rawDb
		.prepare(
			`
    SELECT w.domain, w.port, w.credits, uw.role
    FROM user_workspaces uw
    JOIN workspaces w ON uw.workspace_id = w.id
    WHERE uw.user_id = ?
    ORDER BY w.domain
  `,
		)
		.all(user.id) as Array<{
		domain: string
		port: number
		credits: number
		role: string
	}>

	console.log(`\n🌐 Workspaces (${workspaces.length}):`)
	for (const workspace of workspaces) {
		console.log(`  ${workspace.domain}`)
		console.log(`    ├─ Port: ${workspace.port}`)
		console.log(`    ├─ Credits: ${workspace.credits}`)
		console.log(`    └─ Role: ${workspace.role}`)
	}

	console.log("\n✅ Login test PASSED")
	console.log("\nThis user can authenticate successfully")
}

testLogin().catch((error) => {
	console.error("Error:", error)
	process.exit(1)
})
