#!/usr/bin/env bun
/**
 * Set User Site Quota
 *
 * Updates or creates a user's site quota in app.user_quotas
 *
 * Usage: bun scripts/set-user-quota.ts <email> <max_sites>
 *
 * Examples:
 *   bun scripts/set-user-quota.ts eedenlars@gmail.com 100
 *   bun scripts/set-user-quota.ts user@example.com 10
 */

import { createClient } from "@supabase/supabase-js"
import type { AppDatabase, IamDatabase } from "@webalive/database"

// Get Supabase credentials
function getSupabaseCredentials() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error("❌ Missing Supabase credentials")
    console.error("   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment")
    process.exit(1)
  }

  return { url, key }
}

// Parse arguments
const [email, maxSitesStr] = process.argv.slice(2)

if (!email || !maxSitesStr) {
  console.error("❌ Usage: bun scripts/set-user-quota.ts <email> <max_sites>")
  console.error("")
  console.error("Examples:")
  console.error("  bun scripts/set-user-quota.ts eedenlars@gmail.com 100")
  console.error("  bun scripts/set-user-quota.ts user@example.com 10")
  process.exit(1)
}

const maxSites = Number.parseInt(maxSitesStr, 10)

if (Number.isNaN(maxSites) || maxSites < 0) {
  console.error(`❌ Invalid max_sites value: ${maxSitesStr}`)
  console.error("   Must be a non-negative integer")
  process.exit(1)
}

async function main() {
  const { url, key } = getSupabaseCredentials()

  // Create clients
  const iam = createClient<IamDatabase>(url, key, {
    db: { schema: "iam" },
  })
  const app = createClient<AppDatabase>(url, key, {
    db: { schema: "app" },
  })

  // Look up user by email
  console.log(`🔍 Looking up user: ${email}`)
  const { data: user, error: userError } = await iam
    .from("users")
    .select("user_id, email")
    .eq("email", email.toLowerCase())
    .single()

  if (userError || !user) {
    if (userError?.code === "PGRST116") {
      console.error(`❌ User not found: ${email}`)
    } else {
      console.error(`❌ Failed to look up user: ${userError?.message}`)
    }
    process.exit(1)
  }

  console.log(`✅ Found user: ${user.email} (${user.user_id})`)

  // Check if quota record exists
  const { data: existingQuota } = await app.from("user_quotas").select("max_sites").eq("user_id", user.user_id).single()

  if (existingQuota) {
    // Update existing record
    console.log(`📝 Updating quota: ${existingQuota.max_sites} → ${maxSites}`)
    const { error: updateError } = await app
      .from("user_quotas")
      .update({ max_sites: maxSites })
      .eq("user_id", user.user_id)

    if (updateError) {
      console.error(`❌ Failed to update quota: ${updateError.message}`)
      process.exit(1)
    }
  } else {
    // Insert new record
    console.log(`📝 Creating quota record with max_sites: ${maxSites}`)
    const { error: insertError } = await app.from("user_quotas").insert({
      user_id: user.user_id,
      max_sites: maxSites,
    })

    if (insertError) {
      console.error(`❌ Failed to create quota: ${insertError.message}`)
      process.exit(1)
    }
  }

  console.log(`✅ Successfully set quota for ${email} to ${maxSites} sites`)
}

main()
