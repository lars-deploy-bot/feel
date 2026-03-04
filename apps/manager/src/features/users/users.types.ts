/**
 * Re-export from @webalive/shared — SINGLE SOURCE OF TRUTH
 *
 * Uses subpath import for browser-safety (apps/manager is a Vite browser app).
 * PostHog types (UserDevice, UserLocation, UserProfile) stay in users.api.ts — they're frontend-only.
 */
export type {
  ManagerUser as User,
  ManagerUserEvent as UserEvent,
  ManagerUserOrg as UserOrg,
  ManagerUserSession as UserSession,
} from "@webalive/shared"
