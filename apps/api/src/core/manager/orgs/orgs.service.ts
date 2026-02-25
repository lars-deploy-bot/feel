import { orgsRepo, membersRepo, domainsRepo } from "../../../db/repos"

const VALID_ORG_ROLES = new Set(["owner", "admin", "member"])
function isOrgRole(role: unknown): boolean {
  return typeof role === "string" && VALID_ORG_ROLES.has(role)
}
import { eventBus } from "../../../infra/events"
import type { ManagerOrganization, ManagerOrgMember, ManagerOrgDomain } from "./orgs.types"
import type { MemberRow } from "../../../db/repos/members.repo"
import type { DomainRow } from "../../../db/repos/domains.repo"

function groupMembersByOrg(memberships: MemberRow[]): Record<string, ManagerOrgMember[]> {
  const grouped: Record<string, ManagerOrgMember[]> = {}

  for (const membership of memberships) {
    if (!isOrgRole(membership.role)) {
      continue
    }

    if (!grouped[membership.org_id]) {
      grouped[membership.org_id] = []
    }

    grouped[membership.org_id].push({
      user_id: membership.user_id,
      email: membership.users?.email ?? "Unknown",
      display_name: membership.users?.display_name ?? null,
      role: membership.role,
      created_at: membership.created_at,
    })
  }

  return grouped
}

function groupDomainsByOrg(domains: DomainRow[]): Record<string, ManagerOrgDomain[]> {
  const grouped: Record<string, ManagerOrgDomain[]> = {}

  for (const domain of domains) {
    if (!domain.org_id) continue

    if (!grouped[domain.org_id]) {
      grouped[domain.org_id] = []
    }

    grouped[domain.org_id].push({
      domain_id: domain.domain_id,
      hostname: domain.hostname,
      port: domain.port,
      org_id: domain.org_id,
      server_id: domain.server_id,
      created_at: domain.created_at,
    })
  }

  return grouped
}

export async function listOrgs(): Promise<ManagerOrganization[]> {
  const [orgs, memberships, domains] = await Promise.all([
    orgsRepo.findAll(),
    membersRepo.findAllGrouped(),
    domainsRepo.findAll(),
  ])

  const membersByOrg = groupMembersByOrg(memberships)
  const domainsByOrg = groupDomainsByOrg(domains)

  return orgs.map(org => ({
    org_id: org.org_id,
    name: org.name,
    credits: org.credits,
    created_at: org.created_at,
    updated_at: org.updated_at,
    members: membersByOrg[org.org_id] ?? [],
    member_count: membersByOrg[org.org_id]?.length ?? 0,
    domains: domainsByOrg[org.org_id] ?? [],
    domain_count: domainsByOrg[org.org_id]?.length ?? 0,
  }))
}

export async function createOrg(name: string, credits: number, ownerUserId?: string): Promise<ManagerOrganization> {
  const org = await orgsRepo.create(name, credits)

  if (ownerUserId) {
    await membersRepo.add(org.org_id, ownerUserId, "owner")
  }

  eventBus.emit("org.created", { orgId: org.org_id, name })

  const members = ownerUserId ? await membersRepo.findByOrgId(org.org_id) : []

  const memberList: ManagerOrgMember[] = members.map(m => ({
    user_id: m.user_id,
    email: m.users?.email ?? "Unknown",
    display_name: m.users?.display_name ?? null,
    role: m.role,
    created_at: m.created_at,
  }))

  return {
    org_id: org.org_id,
    name: org.name,
    credits: org.credits,
    created_at: org.created_at,
    updated_at: org.updated_at,
    members: memberList,
    member_count: memberList.length,
    domains: [],
    domain_count: 0,
  }
}

export async function updateOrgCredits(orgId: string, credits: number) {
  const org = await orgsRepo.updateCredits(orgId, credits)

  eventBus.emit("org.credits_updated", { orgId, credits })

  return org
}

export async function deleteOrg(orgId: string): Promise<void> {
  await orgsRepo.deleteOrg(orgId)

  eventBus.emit("org.deleted", { orgId })
}

export async function addMember(orgId: string, userId: string, role: string): Promise<void> {
  if (!isOrgRole(role)) {
    throw new Error(`Invalid org role: ${role}`)
  }

  await membersRepo.add(orgId, userId, role)

  eventBus.emit("member.added", { orgId, userId, role })
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  await membersRepo.remove(orgId, userId)

  eventBus.emit("member.removed", { orgId, userId })
}
