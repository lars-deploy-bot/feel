/**
 * @deprecated Since 2025-11-16 - All repositories migrated to Supabase
 * - Sessions: features/auth/lib/sessionStore.ts (Supabase iam.sessions)
 * - Users: lib/auth/supabase-passwords.ts (Supabase iam.users)
 * - Workspaces/Domains: lib/tokens.ts (Supabase app.domains)
 * - Organizations: lib/tokens.ts (Supabase iam.orgs)
 *
 * These SQLite repositories are NOT USED in production.
 * Safe to remove after verification.
 *
 * Database repositories - export all repository modules
 * Centralized access to all database operations
 */

export { sessionRepository } from "./sessions"
export { userWorkspaceRepository } from "./user-workspaces"
export { userRepository } from "./users"
export { workspaceRepository } from "./workspaces"
