/**
 * @webalive/org
 *
 * Organization membership domain logic.
 * Client+server safe — no Node.js, no DB, no env vars.
 *
 * Server-only functions (email, credits) are in "@webalive/org/server".
 */

export { buildInviteLink } from "./invite.js"
export { canInviteMembers, canRemoveMember, canUpdateOrganization, type OrgRole } from "./permissions.js"
