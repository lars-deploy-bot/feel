/**
 * Domain Registry - Unified domain management for Supabase
 *
 * Handles registration/unregistration of domains across:
 * - Users (iam.users)
 * - Organizations (iam.orgs)
 * - Memberships (iam.org_memberships)
 * - Domains (app.domains)
 */

import { createClient } from "@supabase/supabase-js"
import type { Database as AppDatabase } from "../supabase/app.types"
import type { Database as IamDatabase } from "../supabase/iam.types"

/** Full domain information including infrastructure and ownership */
export interface DomainInfo {
  hostname: string
  port: number
  credits: number
  orgId: string
  orgName: string
  ownerEmail: string
  createdAt: string
}

/** Configuration for registering a new domain */
export interface DomainRegistration {
  hostname: string
  email: string
  passwordHash?: string // Optional: if undefined, link to existing user
  port: number
  orgId: string // REQUIRED: Organization ID to deploy to (use getUserDefaultOrgId() to get)
  credits?: number // Deprecated: Credits are now managed per-org, not per-domain
}

/**
 * Get Supabase credentials from environment
 * Works in both Next.js and standalone script contexts
 */
function getSupabaseCredentials() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error("Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.")
  }

  return { url, key }
}

/**
 * Create IAM schema client
 * Uses direct credentials for compatibility with standalone scripts
 */
async function getIamClient() {
  const { url, key } = getSupabaseCredentials()
  return createClient<IamDatabase>(url, key, {
    db: { schema: "iam" },
  })
}

/**
 * Create App schema client
 * Uses direct credentials for compatibility with standalone scripts
 */
async function getAppClient() {
  const { url, key } = getSupabaseCredentials()
  return createClient<AppDatabase>(url, key, {
    db: { schema: "app" },
  })
}

/**
 * Get all domains with full information
 * Joins domains → orgs → users to get complete picture
 */
export async function getAllDomains(): Promise<DomainInfo[]> {
  const app = await getAppClient()
  const iam = await getIamClient()

  // Get all domains with org IDs
  const { data: domains, error: domainsError } = await app.from("domains").select("hostname, port, org_id, created_at")

  if (domainsError || !domains) {
    console.error("[Domain Registry] Failed to fetch domains:", domainsError)
    return []
  }

  // Get all orgs
  const { data: orgs, error: orgsError } = await iam.from("orgs").select("org_id, name, credits")

  if (orgsError || !orgs) {
    console.error("[Domain Registry] Failed to fetch orgs:", orgsError)
    return []
  }

  // Get all owner memberships
  const { data: memberships, error: membershipsError } = await iam
    .from("org_memberships")
    .select("org_id, user_id")
    .eq("role", "owner")

  if (membershipsError || !memberships) {
    console.error("[Domain Registry] Failed to fetch memberships:", membershipsError)
    return []
  }

  // Get all users
  const { data: users, error: usersError } = await iam.from("users").select("user_id, email")

  if (usersError || !users) {
    console.error("[Domain Registry] Failed to fetch users:", usersError)
    return []
  }

  // Build lookup maps
  const orgMap = new Map(orgs.map(o => [o.org_id, { name: o.name, credits: o.credits ?? 0 }]))
  const ownerMap = new Map(memberships.map(m => [m.org_id, m.user_id]))
  const userMap = new Map(users.map(u => [u.user_id, u.email]))

  // Combine all data
  return domains.map(d => {
    const orgId = d.org_id
    return {
      hostname: d.hostname,
      port: d.port,
      credits: orgId ? (orgMap.get(orgId)?.credits ?? 0) : 0,
      orgId: orgId ?? "",
      orgName: orgId ? (orgMap.get(orgId)?.name ?? "Unknown") : "Unknown",
      ownerEmail: orgId ? (userMap.get(ownerMap.get(orgId) ?? "") ?? "unknown@goalive.nl") : "unknown@goalive.nl",
      createdAt: d.created_at ?? new Date().toISOString(),
    }
  })
}

/**
 * Register a new domain in Supabase
 * Creates user (if needed) and domain entry in specified organization
 *
 * CRITICAL: orgId must be provided and validated before calling this function
 * Use getUserDefaultOrgId() or validateUserOrgAccess() from org-resolver.ts
 *
 * @returns true if successful, false otherwise
 */
export async function registerDomain(config: DomainRegistration): Promise<boolean> {
  const { hostname, email, passwordHash, port, orgId } = config

  if (!orgId) {
    console.error("[Domain Registry] orgId is required but was not provided")
    return false
  }

  try {
    const iam = await getIamClient()
    const app = await getAppClient()

    // Step 1: Check if domain already exists
    const { data: existingDomain } = await app.from("domains").select("hostname").eq("hostname", hostname).single()

    if (existingDomain) {
      console.log(`[Domain Registry] Domain ${hostname} already exists`)
      return true
    }

    // Step 2: Get or create user
    let _userId: string
    const { data: existingUser } = await iam.from("users").select("user_id").eq("email", email).single()

    if (existingUser) {
      // User exists - link domain to their account
      _userId = existingUser.user_id
      console.log(`[Domain Registry] User ${email} already exists, linking domain to their account`)
    } else {
      // User doesn't exist - need to create new account
      if (!passwordHash) {
        console.error(`[Domain Registry] Cannot create new user ${email} without password`)
        return false
      }

      const { data: newUser, error: userError } = await iam
        .from("users")
        .insert({
          email: email,
          password_hash: passwordHash,
          status: "active",
          is_test_env: false,
          metadata: {},
        })
        .select("user_id")
        .single()

      if (userError || !newUser) {
        console.error(`[Domain Registry] Failed to create user ${email}:`, userError)
        return false
      }

      _userId = newUser.user_id
      console.log(`[Domain Registry] Created new user account for ${email}`)
    }

    // Step 3: Validate organization exists and user has access
    // NOTE: orgId should have been validated by caller using validateUserOrgAccess()
    // This is a safety check to ensure org exists in database
    const { data: orgExists, error: orgCheckError } = await iam
      .from("orgs")
      .select("org_id")
      .eq("org_id", orgId)
      .single()

    if (orgCheckError || !orgExists) {
      console.error(`[Domain Registry] Organization ${orgId} not found:`, orgCheckError)
      return false
    }

    console.log(`[Domain Registry] Using organization ${orgId} for domain ${hostname}`)

    // Step 4: Create domain entry
    const { error: domainError } = await app.from("domains").insert({
      hostname: hostname,
      port: port,
      org_id: orgId,
    })

    if (domainError) {
      console.error("[Domain Registry] Failed to create domain:", domainError)
      return false
    }

    console.log(`[Domain Registry] Successfully registered ${hostname}`)
    return true
  } catch (error) {
    console.error(`[Domain Registry] Error registering domain ${hostname}:`, error)
    return false
  }
}

/**
 * Unregister a domain from Supabase
 * Removes domain entry (org/memberships preserved for credit history)
 *
 * @returns true if successful, false otherwise
 */
export async function unregisterDomain(hostname: string): Promise<boolean> {
  try {
    const app = await getAppClient()

    // Check if domain exists
    const { data: domainData } = await app.from("domains").select("hostname").eq("hostname", hostname).single()

    if (!domainData) {
      console.log(`[Domain Registry] Domain ${hostname} not found (already removed)`)
      return true
    }

    // Delete domain
    const { error } = await app.from("domains").delete().eq("hostname", hostname)

    if (error) {
      console.error(`[Domain Registry] Failed to delete domain ${hostname}:`, error)
      return false
    }

    console.log(`[Domain Registry] Successfully unregistered ${hostname}`)
    return true
  } catch (error) {
    console.error(`[Domain Registry] Error unregistering domain ${hostname}:`, error)
    return false
  }
}
