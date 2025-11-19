#!/usr/bin/env bun
/**
 * Sync Orphaned Domains to Supabase
 * Finds domains in JSON but not in Supabase and migrates them
 *
 * Usage: bun scripts/sync-orphaned-domains.ts
 */

import { readFileSync } from "node:fs"
import { getAllDomains, registerDomain } from "../lib/deployment/domain-registry"
import { getUserDefaultOrgId } from "../lib/deployment/org-resolver"
import { createIamClient } from "../lib/supabase/iam"

// Load JSON files
const DOMAIN_PASSWORDS_FILE = "/var/lib/claude-bridge/domain-passwords.json"
const WORKSPACES_FILE = "/var/lib/claude-bridge/workspaces.json"

interface DomainData {
  port: number
  passwordHash: string
  createdAt?: string
  credits?: number
  email?: string
}

interface WorkspaceData {
  domain: string
  owner: string
  members: string[]
  port: number
  createdAt: string
}

type DomainsJson = Record<string, DomainData>
type WorkspacesJson = Record<string, WorkspaceData>

console.log("📂 Loading JSON files...")
const domainsJson: DomainsJson = JSON.parse(readFileSync(DOMAIN_PASSWORDS_FILE, "utf-8"))
const workspacesJson: WorkspacesJson = JSON.parse(readFileSync(WORKSPACES_FILE, "utf-8"))

const jsonDomains = Object.keys(domainsJson)
console.log(`   Found ${jsonDomains.length} domains in JSON`)

async function syncOrphanedDomains() {
  try {
    // Step 1: Get all domains from Supabase
    const supabaseDomains = await getAllDomains()
    const supabaseDomainSet = new Set(supabaseDomains.map(d => d.hostname))
    console.log(`   Found ${supabaseDomainSet.size} domains in Supabase`)

    // Step 2: Find orphaned domains (in JSON but not in Supabase)
    const orphanedDomains = jsonDomains.filter(domain => !supabaseDomainSet.has(domain))

    console.log(`\n🔍 Found ${orphanedDomains.length} orphaned domains to migrate`)

    if (orphanedDomains.length === 0) {
      console.log("✅ All domains are already in Supabase!")
      return
    }

    console.log("   Orphaned domains:", orphanedDomains.join(", "))

    // Step 3: Migrate each orphaned domain
    let migrated = 0
    let failed = 0

    for (const domain of orphanedDomains) {
      console.log(`\n📦 Migrating ${domain}...`)

      const domainData = domainsJson[domain]
      const workspace = workspacesJson[domain]

      // Use workspace owner if available, fallback to domain email or default
      const email = workspace?.owner || domainData.email || "barendbootsma@gmail.com"
      const port = domainData.port
      const credits = domainData.credits || 200

      // Get or create organization for the user
      // First, we need to get the user ID from the email
      // registerDomain will handle user lookup/creation internally
      // We need to create a temporary IAM client to get orgId
      const iam = await createIamClient("service")

      // Get user by email
      const { data: user } = await iam.from("users").select("user_id").eq("email", email).single()

      let orgId: string
      if (user) {
        // Get or create default org for existing user
        orgId = await getUserDefaultOrgId(user.user_id, email, credits, iam)
      } else {
        // Skip - registerDomain will create user and org
        console.log(`⚠️  User ${email} not found - registerDomain will create user+org`)
        // We can't proceed without a userId, so skip this for now
        // The registerDomain function should handle this internally
        failed++
        continue
      }

      const success = await registerDomain({
        hostname: domain,
        email,
        // Note: For migration, we don't pass password/passwordHash
        // If user exists, domain will be linked without password verification
        // If user doesn't exist, migration is skipped (see check above)
        port,
        orgId,
        credits,
      })

      if (success) {
        migrated++
      } else {
        failed++
      }
    }

    console.log(`\n${"=".repeat(50)}`)
    console.log(`✅ Migration complete: ${migrated} migrated, ${failed} failed`)
  } catch (error) {
    console.error("❌ Error syncing orphaned domains:", error)
    process.exit(1)
  }
}

syncOrphanedDomains()
