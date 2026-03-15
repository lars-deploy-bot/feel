/**
 * Invite link utilities.
 *
 * Pure functions — safe for both client and server.
 */

/**
 * Build an invite link from a referral code and base URL.
 *
 * @param code - The invite code (e.g. "K7HTMF4WQP")
 * @param baseUrl - The base URL (e.g. "https://app.alive.best")
 * @throws if baseUrl is falsy
 */
export function buildInviteLink(code: string, baseUrl: string): string {
  if (!baseUrl) throw new Error("[referral] baseUrl is required for invite link generation")
  return `${baseUrl}/invite/${code}`
}
