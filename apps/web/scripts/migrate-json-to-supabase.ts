#!/usr/bin/env bun
/**
 * Migration Script: JSON → Supabase
 * Migrates users, workspaces, and domains from JSON files to Supabase tables
 *
 * ⚠️ MIGRATION COMPLETED: 2025-11-14
 * - 12 users migrated
 * - 12 organizations created (grouped by unique teams)
 * - 55 domains linked to orgs
 * - 14 org memberships created
 *
 * DO NOT RUN AGAIN unless re-migrating after database cleanup!
 *
 * Usage: bun scripts/migrate-json-to-supabase.ts
 */

import { createClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"
import { readFileSync } from "fs"
import type { Database as AppDatabase } from "../lib/supabase/app.types"
import type { Database as IamDatabase } from "../lib/supabase/iam.types"

// ID generation helpers with prefixes
function generateUserId(): string {
  return `user_${randomUUID()}`
}

function generateOrgId(): string {
  return `org_${randomUUID()}`
}

function generateDomainId(): string {
  return `domain_${randomUUID()}`
}

// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing Supabase credentials in environment")
  console.error("   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")
  process.exit(1)
}

// Create Supabase clients for each schema
const iamClient = createClient<IamDatabase>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  db: { schema: "iam" },
})

const appClient = createClient<AppDatabase>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  db: { schema: "app" },
})

// Load JSON files
const USERS_FILE = "/var/lib/claude-bridge/users.json"
const WORKSPACES_FILE = "/var/lib/claude-bridge/workspaces.json"
const DOMAINS_FILE = "/var/lib/claude-bridge/domain-passwords.json"

interface UserData {
  email: string
  workspaces: string[]
  credits: number
  passwordHash: string
}

interface WorkspaceData {
  domain: string
  owner: string
  members: string[]
  port: number
  createdAt: string
}

interface DomainData {
  tenantId?: string
  port: number
  passwordHash: string
  createdAt?: string
  credits: number
  password?: string
}

type UsersJson = Record<string, UserData>
type WorkspacesJson = Record<string, WorkspaceData>
type DomainsJson = Record<string, DomainData>

console.log("📂 Loading JSON files...")
const usersJson: UsersJson = JSON.parse(readFileSync(USERS_FILE, "utf-8"))
const workspacesJson: WorkspacesJson = JSON.parse(readFileSync(WORKSPACES_FILE, "utf-8"))
const domainsJson: DomainsJson = JSON.parse(readFileSync(DOMAINS_FILE, "utf-8"))

console.log(`   ✓ ${Object.keys(usersJson).length} users loaded`)
console.log(`   ✓ ${Object.keys(workspacesJson).length} workspaces loaded`)
console.log(`   ✓ ${Object.keys(domainsJson).length} domains loaded`)

// Mappings to track created entities
const emailToUserId = new Map<string, string>()
const domainToOrgId = new Map<string, string>()

// Helper to create unique team key
function createTeamKey(owner: string, members: string[]): string {
  // Sort members to ensure consistent key regardless of order
  const sortedMembers = [...members].sort()
  return `${owner}::${sortedMembers.join(",")}`
}

async function migrateUsers() {
  console.log("\n👤 Migrating Users...")

  // Fetch existing users
  const { data: existingUsers, error: fetchError } = await iamClient.from("users").select("user_id, email")

  if (fetchError) {
    console.error("❌ Failed to fetch existing users:", fetchError)
    throw fetchError
  }

  console.log(`   Found ${existingUsers?.length || 0} existing users in database`)

  // Build map of existing users
  const existingUserMap = new Map<string, string>()
  for (const user of existingUsers || []) {
    existingUserMap.set(user.email!, user.user_id)
  }

  let updated = 0
  let created = 0

  for (const [email, userData] of Object.entries(usersJson)) {
    const existingUserId = existingUserMap.get(email)

    if (existingUserId) {
      // UPDATE existing user with password_hash
      const { error } = await iamClient
        .from("users")
        .update({ password_hash: userData.passwordHash })
        .eq("user_id", existingUserId)

      if (error) {
        console.error(`   ❌ Failed to update user ${email}:`, error)
        throw error
      }

      emailToUserId.set(email, existingUserId)
      updated++
      console.log(`   ✓ Updated ${email} (user_id: ${existingUserId})`)
    } else {
      // INSERT new user (let database auto-generate user_id)
      const { data, error } = await iamClient
        .from("users")
        .insert({
          email: email,
          password_hash: userData.passwordHash,
          status: "active",
          is_test_env: false,
          metadata: {},
        })
        .select("user_id")
        .single()

      if (error || !data) {
        console.error(`   ❌ Failed to create user ${email}:`, error)
        throw error
      }

      emailToUserId.set(email, data.user_id)
      created++
      console.log(`   ✓ Created ${email} (user_id: ${data.user_id})`)
    }
  }

  console.log(`   Summary: ${updated} updated, ${created} created`)
}

async function migrateOrgs() {
  console.log("\n🏢 Migrating Organizations...")

  // Group workspaces by unique teams (owner + members)
  const teamToWorkspaces = new Map<
    string,
    {
      owner: string
      members: string[]
      domains: string[]
      totalCredits: number
      earliestCreatedAt: string
    }
  >()

  for (const [domain, workspace] of Object.entries(workspacesJson)) {
    const teamKey = createTeamKey(workspace.owner, workspace.members)
    const credits = domainsJson[domain]?.credits || 200

    if (!teamToWorkspaces.has(teamKey)) {
      teamToWorkspaces.set(teamKey, {
        owner: workspace.owner,
        members: workspace.members,
        domains: [],
        totalCredits: 0,
        earliestCreatedAt: workspace.createdAt,
      })
    }

    const team = teamToWorkspaces.get(teamKey)!
    team.domains.push(domain)
    team.totalCredits += credits

    // Use earliest creation date
    if (workspace.createdAt < team.earliestCreatedAt) {
      team.earliestCreatedAt = workspace.createdAt
    }
  }

  console.log(`   Found ${teamToWorkspaces.size} unique teams (will create ${teamToWorkspaces.size} orgs)`)

  let created = 0
  const teamKeyToOrgId = new Map<string, string>()

  for (const [teamKey, team] of teamToWorkspaces.entries()) {
    // Use owner's email as org name (cleaner than listing all domains)
    const orgName = `${team.owner.split("@")[0]}'s organization`

    // Let database auto-generate org_id
    const { data, error } = await iamClient
      .from("orgs")
      .insert({
        name: orgName,
        credits: team.totalCredits,
        created_at: team.earliestCreatedAt,
      })
      .select("org_id")
      .single()

    if (error || !data) {
      console.error(`   ❌ Failed to create org for ${team.owner}:`, error)
      throw error
    }

    teamKeyToOrgId.set(teamKey, data.org_id)

    // Map all domains to this org
    for (const domain of team.domains) {
      domainToOrgId.set(domain, data.org_id)
    }

    created++
    console.log(
      `   ✓ Created org "${orgName}" (${team.domains.length} domains, ${team.totalCredits} credits, org_id: ${data.org_id})`,
    )
  }

  console.log(`   Summary: ${created} orgs created for ${teamToWorkspaces.size} unique teams`)
}

async function migrateMemberships() {
  console.log("\n👥 Migrating Organization Memberships...")

  // Track which org IDs we've already created memberships for
  const processedOrgs = new Set<string>()
  let created = 0
  let skipped = 0

  for (const [domain, workspace] of Object.entries(workspacesJson)) {
    const orgId = domainToOrgId.get(domain)
    if (!orgId) {
      console.error(`   ⚠️  Skipping ${domain}: org not found`)
      continue
    }

    // Skip if we've already created memberships for this org
    if (processedOrgs.has(orgId)) {
      skipped++
      continue
    }

    // Create owner membership
    const ownerUserId = emailToUserId.get(workspace.owner)
    if (!ownerUserId) {
      console.error(`   ⚠️  Owner ${workspace.owner} not found for ${domain}`)
      continue
    }

    const { error: ownerError } = await iamClient.from("org_memberships").insert({
      org_id: orgId,
      user_id: ownerUserId,
      role: "owner",
    })

    if (ownerError) {
      console.error(`   ❌ Failed to create owner membership for ${domain}:`, ownerError)
      throw ownerError
    }
    created++

    // Create member memberships
    for (const memberEmail of workspace.members) {
      if (memberEmail === workspace.owner) continue // Skip owner (already added)

      const memberUserId = emailToUserId.get(memberEmail)
      if (!memberUserId) {
        console.error(`   ⚠️  Member ${memberEmail} not found for ${domain}`)
        continue
      }

      const { error: memberError } = await iamClient.from("org_memberships").insert({
        org_id: orgId,
        user_id: memberUserId,
        role: "member",
      })

      if (memberError) {
        console.error(`   ❌ Failed to create member membership for ${memberEmail} in ${domain}:`, memberError)
        throw memberError
      }
      created++
    }

    processedOrgs.add(orgId)
    console.log(`   ✓ Created memberships for org (${workspace.members.length} members via ${domain})`)
  }

  console.log(`   Summary: ${created} memberships created (${skipped} duplicate orgs skipped)`)
}

async function migrateDomains() {
  console.log("\n🌐 Migrating Domains...")

  let created = 0

  for (const [hostname, domainData] of Object.entries(domainsJson)) {
    const orgId = domainToOrgId.get(hostname)

    if (!orgId) {
      console.warn(`   ⚠️  No org found for domain ${hostname}, skipping...`)
      continue
    }

    const { error } = await appClient.from("domains").insert({
      hostname: hostname,
      port: domainData.port,
      org_id: orgId,
      created_at: domainData.createdAt || new Date().toISOString(),
    })

    if (error) {
      console.error(`   ❌ Failed to create domain ${hostname}:`, error)
      throw error
    }

    created++
    console.log(`   ✓ Created domain ${hostname} (port ${domainData.port})`)
  }

  console.log(`   Summary: ${created} domains created`)
}

async function verifyMigration() {
  console.log("\n✅ Verifying Migration...")

  const { data: users } = await iamClient.from("users").select("user_id")
  const { data: orgs } = await iamClient.from("orgs").select("org_id")
  const { data: memberships } = await iamClient.from("org_memberships").select("user_id")
  const { data: domains } = await appClient.from("domains").select("domain_id")

  console.log(`   Users: ${users?.length || 0}`)
  console.log(`   Orgs: ${orgs?.length || 0}`)
  console.log(`   Memberships: ${memberships?.length || 0}`)
  console.log(`   Domains: ${domains?.length || 0}`)

  // Verify credits sum
  const { data: orgCredits } = await iamClient.from("orgs").select("credits")
  const totalCredits = orgCredits?.reduce((sum, org) => sum + Number(org.credits), 0) || 0
  const originalCredits = Object.values(domainsJson).reduce((sum, d) => sum + (d.credits || 200), 0)

  console.log(`   Total credits: ${totalCredits} (expected: ${originalCredits})`)

  if (totalCredits === originalCredits) {
    console.log("   ✓ Credit balance matches!")
  } else {
    console.warn("   ⚠️  Credit balance mismatch!")
  }
}

async function main() {
  console.log("🚀 Starting Migration: JSON → Supabase\n")
  console.log("=".repeat(50))

  try {
    await migrateUsers()
    await migrateOrgs()
    await migrateMemberships()
    await migrateDomains()
    await verifyMigration()

    console.log("\n" + "=".repeat(50))
    console.log("✨ Migration completed successfully!")
  } catch (error) {
    console.error("\n💥 Migration failed:", error)
    process.exit(1)
  }
}

main()
