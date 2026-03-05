import {
  type ClaudeModel,
  isValidClaudeModel,
  type ManagerPasswordResetToken,
  type ManagerUser,
  type ManagerUserOrg,
  type ManagerUserSession,
} from "@webalive/shared"
import { app, iam } from "../../../db/clients"
import { usersRepo } from "../../../db/repos"
import type { UserRow } from "../../../db/repos/users.repo"
import { InternalError } from "../../../infra/errors"
import { issuePasswordResetToken } from "../../auth/auth.service"

interface MembershipWithOrg {
  user_id: string
  role: string
  orgs: { org_id: string; name: string } | null
}

async function fetchMembershipsGrouped(): Promise<Record<string, ManagerUserOrg[]>> {
  const { data, error } = await iam.from("org_memberships").select(`
      user_id,
      role,
      orgs:org_id (
        org_id,
        name
      )
    `)

  if (error) {
    throw new InternalError(`Failed to fetch memberships: ${error.message}`)
  }

  const grouped: Record<string, ManagerUserOrg[]> = {}
  for (const row of (data ?? []) as unknown as MembershipWithOrg[]) {
    if (!row.orgs) continue
    if (!grouped[row.user_id]) {
      grouped[row.user_id] = []
    }
    grouped[row.user_id].push({
      org_id: row.orgs.org_id,
      name: row.orgs.name,
      role: row.role,
    })
  }
  return grouped
}

interface SessionRow {
  user_id: string
  domain_id: string
  last_activity: string
}

interface SessionsGrouped {
  /** user_id → last_activity (max) */
  activity: Record<string, string>
  /** user_id → ManagerUserSession[] */
  sessions: Record<string, ManagerUserSession[]>
}

async function fetchSessionsGrouped(): Promise<SessionsGrouped> {
  const { data, error } = await iam
    .from("sessions")
    .select("user_id, domain_id, last_activity")
    .order("last_activity", { ascending: false })

  if (error) {
    console.error(`Failed to fetch sessions: ${error.message}`)
    return { activity: {}, sessions: {} }
  }

  const rows = (data ?? []) as SessionRow[]

  // Collect unique domain_ids to resolve hostnames
  const domainIds = [...new Set(rows.map(r => r.domain_id).filter(Boolean))]
  const hostnameMap: Record<string, string> = {}

  if (domainIds.length > 0) {
    const { data: domains } = await app.from("domains").select("domain_id, hostname").in("domain_id", domainIds)

    for (const d of domains ?? []) {
      hostnameMap[d.domain_id] = d.hostname
    }
  }

  const activity: Record<string, string> = {}
  // Track per-user per-domain: { count, lastActivity }
  const perUserDomain: Record<string, Record<string, { count: number; last: string }>> = {}

  for (const row of rows) {
    // Activity: first occurrence per user is the max (ordered desc)
    if (!activity[row.user_id]) {
      activity[row.user_id] = row.last_activity
    }

    // Sessions grouped by domain
    if (!perUserDomain[row.user_id]) {
      perUserDomain[row.user_id] = {}
    }
    const domainKey = row.domain_id
    if (!perUserDomain[row.user_id][domainKey]) {
      perUserDomain[row.user_id][domainKey] = { count: 0, last: row.last_activity }
    }
    perUserDomain[row.user_id][domainKey].count++
  }

  const sessions: Record<string, ManagerUserSession[]> = {}
  for (const [userId, domains] of Object.entries(perUserDomain)) {
    sessions[userId] = Object.entries(domains).map(([domainId, info]) => ({
      domain_hostname: hostnameMap[domainId] ?? domainId,
      session_count: info.count,
      last_activity: info.last,
    }))
  }

  return { activity, sessions }
}

function isJsonObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
}

function extractEnabledModels(metadata: unknown): ClaudeModel[] {
  if (!isJsonObject(metadata)) return []
  const raw = metadata.enabled_models
  if (!Array.isArray(raw)) return []
  return raw.filter((v): v is ClaudeModel => typeof v === "string" && isValidClaudeModel(v))
}

function enrichUser(
  u: UserRow,
  orgsByUser: Record<string, ManagerUserOrg[]>,
  sessionsData: SessionsGrouped,
): ManagerUser {
  const orgs = orgsByUser[u.user_id] ?? []
  const userSessions = sessionsData.sessions[u.user_id] ?? []
  const totalSessions = userSessions.reduce((sum, s) => sum + s.session_count, 0)

  return {
    user_id: u.user_id,
    email: u.email,
    display_name: u.display_name,
    status: u.status,
    created_at: u.created_at,
    updated_at: u.updated_at,
    orgs,
    org_count: orgs.length,
    last_active: sessionsData.activity[u.user_id] ?? null,
    sessions: userSessions,
    session_count: totalSessions,
    enabled_models: extractEnabledModels(u.metadata),
  }
}

export async function listUsers(): Promise<ManagerUser[]> {
  const [users, orgsByUser, sessionsData] = await Promise.all([
    usersRepo.findAll(),
    fetchMembershipsGrouped(),
    fetchSessionsGrouped(),
  ])

  return users.map(u => enrichUser(u, orgsByUser, sessionsData))
}

export async function getUserById(userId: string): Promise<ManagerUser> {
  const [u, orgsByUser, sessionsData] = await Promise.all([
    usersRepo.findById(userId),
    fetchMembershipsGrouped(),
    fetchSessionsGrouped(),
  ])

  return enrichUser(u, orgsByUser, sessionsData)
}

export async function updateEnabledModels(userId: string, models: ClaudeModel[]): Promise<void> {
  const user = await usersRepo.findById(userId)
  const base = isJsonObject(user.metadata) ? user.metadata : {}
  await usersRepo.updateMetadata(userId, { ...base, enabled_models: models })
}

export async function createPasswordResetToken(userId: string): Promise<ManagerPasswordResetToken> {
  return issuePasswordResetToken(userId)
}
