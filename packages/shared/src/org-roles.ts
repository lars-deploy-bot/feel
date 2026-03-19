export const ORG_ROLES = ["owner", "admin", "member"] as const
export type OrgRole = (typeof ORG_ROLES)[number]

const ORG_ROLE_SET: ReadonlySet<string> = new Set(ORG_ROLES)

export const ORG_ROLES_WITH_VIEWER = [...ORG_ROLES, "viewer"] as const
export type OrgRoleWithViewer = (typeof ORG_ROLES_WITH_VIEWER)[number]

const ORG_ROLE_WITH_VIEWER_SET: ReadonlySet<string> = new Set(ORG_ROLES_WITH_VIEWER)

export type OrgRoleMap = Record<string, OrgRole>

export interface OrgMembershipLike {
  org_id: string | null
  role: unknown
}

export interface SessionOrgClaims {
  orgIds: string[]
  orgRoles: OrgRoleMap
}

export function isOrgRole(role: unknown): role is OrgRole {
  return typeof role === "string" && ORG_ROLE_SET.has(role)
}

export function isOrgRoleWithViewer(role: unknown): role is OrgRoleWithViewer {
  return typeof role === "string" && ORG_ROLE_WITH_VIEWER_SET.has(role)
}

export function isOrgAdminRole(role: unknown): role is Extract<OrgRole, "owner" | "admin"> {
  return role === "owner" || role === "admin"
}

/**
 * Build normalized session claims from org membership rows.
 * Invalid rows (missing org_id or unsupported role) are skipped.
 */
export function buildSessionOrgClaims(memberships: readonly OrgMembershipLike[] | null | undefined): SessionOrgClaims {
  if (!memberships || memberships.length === 0) {
    return { orgIds: [], orgRoles: {} }
  }

  const orgIds: string[] = []
  const orgRoles: OrgRoleMap = {}

  for (const membership of memberships) {
    if (!membership.org_id) continue
    if (!isOrgRole(membership.role)) continue

    orgIds.push(membership.org_id)
    orgRoles[membership.org_id] = membership.role
  }

  return {
    orgIds: [...new Set(orgIds)],
    orgRoles,
  }
}
