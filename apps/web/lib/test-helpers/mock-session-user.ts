import type { SessionUser } from "@/features/auth/lib/auth"

/**
 * Default mock SessionUser for unit tests.
 *
 * Import this instead of copy-pasting the same 10 fields in every test file.
 * Use `createMockSessionUser()` when you need to override specific fields.
 */
export const MOCK_SESSION_USER: SessionUser = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
  firstName: null,
  lastName: null,
  canSelectAnyModel: false,
  isAdmin: false,
  isSuperadmin: false,
  enabledModels: [],
}

/**
 * Create a mock SessionUser with optional overrides.
 *
 * @example
 * const admin = createMockSessionUser({ isAdmin: true, isSuperadmin: true })
 * const custom = createMockSessionUser({ id: "user-456", email: "other@test.com" })
 */
export function createMockSessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return { ...MOCK_SESSION_USER, ...overrides }
}
