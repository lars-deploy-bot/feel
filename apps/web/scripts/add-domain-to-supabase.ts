#!/usr/bin/env bun
/**
 * Add Domain to Supabase
 * Called by deploy-site-systemd.sh to register new domains in Supabase
 *
 * Usage: bun scripts/add-domain-to-supabase.ts <domain> <email> <passwordHash> <port>
 *
 * Note: If passwordHash is empty, domain will be linked to existing user (no new account created)
 *
 * IMPORTANT: This script now uses organization-based deployment
 * - Gets user's default organization (creates if needed)
 * - Registers domain under that organization
 * - Multiple domains for same user will share the same organization
 */

import { registerDomain } from "../lib/deployment/domain-registry"
import { getUserDefaultOrgId } from "../lib/deployment/org-resolver"
import { createIamClient } from "../lib/supabase/iam"

// Parse arguments
const [hostname, email, passwordHash, portStr] = process.argv.slice(2)
const port = Number.parseInt(portStr, 10)

// Validate required arguments
if (!hostname || !email || !port || Number.isNaN(port)) {
  console.error("❌ Usage: bun scripts/add-domain-to-supabase.ts <domain> <email> <passwordHash> <port>")
  console.error("   passwordHash can be empty to link to existing user")
  process.exit(1)
}

// If passwordHash is empty, we're linking to existing user
const linkToExistingUser = !passwordHash || passwordHash.trim() === ""

if (linkToExistingUser) {
  console.log(`📎 Linking ${hostname} to existing user: ${email}`)
} else {
  console.log(`👤 Creating/updating account for ${email}`)
}

async function main() {
  try {
    // Step 1: Get user ID (registerDomain will create user if needed)
    // We need to determine orgId before calling registerDomain
    // First check if user exists
    const iam = await createIamClient("service")
    const { data: existingUser } = await iam.from("users").select("user_id").eq("email", email).single()

    let userId: string

    if (existingUser) {
      userId = existingUser.user_id
      console.log(`📋 Found existing user: ${email} (${userId})`)
    } else {
      // User will be created by registerDomain, but we need a temporary approach
      // For now, we'll register first with a placeholder org, then update
      // Actually, let's refactor: we need to ensure user exists BEFORE getting orgId

      if (!passwordHash || passwordHash.trim() === "") {
        console.error("❌ Cannot create new user without password")
        process.exit(1)
      }

      // Create user first (password already hashed by deploy script)
      const hashedPassword = passwordHash

      const { data: newUser, error: userError } = await iam
        .from("users")
        .insert({
          email: email,
          password_hash: hashedPassword,
          status: "active",
          is_test_env: false,
          metadata: {},
        })
        .select("user_id")
        .single()

      if (userError || !newUser) {
        console.error(`❌ Failed to create user ${email}:`, userError)
        process.exit(1)
      }

      userId = newUser.user_id
      console.log(`✅ Created new user: ${email} (${userId})`)
    }

    // Step 2: Get or create default organization for user
    console.log(`🏢 Resolving organization for user ${email}...`)
    const orgId = await getUserDefaultOrgId(userId, email, 200)
    console.log(`✅ Using organization: ${orgId}`)

    // Step 3: Register domain in organization
    console.log(`🌐 Registering domain ${hostname}...`)
    const success = await registerDomain({
      hostname,
      email,
      passwordHash: passwordHash || undefined, // Pass undefined if empty
      port,
      orgId, // REQUIRED: Pass the resolved organization ID
    })

    if (!success) {
      console.error(`❌ Failed to register ${hostname}`)
      process.exit(1)
    }

    console.log(`✅ Successfully registered ${hostname} in organization ${orgId}`)
  } catch (error) {
    console.error("❌ Error:", error)
    process.exit(1)
  }
}

main()
