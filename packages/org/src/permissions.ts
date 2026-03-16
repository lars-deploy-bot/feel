/**
 * Organization member permission checks.
 *
 * Pure functions — safe for both client and server.
 * No HTTP, no DB, no env vars.
 */

import { isOrgAdminRole, type OrgRole } from "@webalive/shared"

export type { OrgRole }

/**
 * Check if a user can remove another member from an organization.
 *
 * Rules:
 * - Owner: can remove anyone (caller enforces "last owner" guard separately)
 * - Admin: can remove members only, can self-leave
 * - Member: can only self-leave
 * - No role: no permission
 */
export function canRemoveMember(
  currentUserRole: OrgRole | null | undefined,
  targetUserRole: OrgRole,
  isCurrentUser: boolean,
): boolean {
  if (!currentUserRole) return false
  if (isCurrentUser) return true
  if (currentUserRole === "member") return false
  if (currentUserRole === "admin") return targetUserRole === "member"
  if (currentUserRole === "owner") return true
  return false
}

/**
 * Check if a user can update organization settings.
 */
export function canUpdateOrganization(userRole: OrgRole | null | undefined): boolean {
  return isOrgAdminRole(userRole)
}

/**
 * Check if a user can invite members to an organization.
 */
export function canInviteMembers(userRole: OrgRole | null | undefined): boolean {
  return isOrgAdminRole(userRole)
}
