// Main database types file
// Imports and re-exports generated schema types
// DO NOT EDIT MANUALLY - Run 'bun run gen:types' to regenerate

// Export common types from public schema (if available) or lockbox as fallback
export {
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  CompositeTypes,
} from "./public.generated"

// Import Database types for renaming
import type { Database as LockboxDatabase } from "./lockbox.generated"
import type { Database as IntegrationsDatabase } from "./integrations.generated"
import type { Database as IamDatabase } from "./iam.generated"
import type { Database as PublicDatabase } from "./public.generated"
import type { Database as AppDatabase } from "./app.generated"

// Re-export with schema-specific names
export type { LockboxDatabase }
export type { IntegrationsDatabase }
export type { IamDatabase }
export type { PublicDatabase }
export type { AppDatabase }

// Re-export the main Database type for backward compatibility
export type Database = PublicDatabase

// ============================================
// Convenience type exports for common tables
// ============================================

// IAM Schema Types
export type IamUser = IamDatabase["iam"]["Tables"]["users"]["Row"]
export type IamUserInsert = IamDatabase["iam"]["Tables"]["users"]["Insert"]
export type IamOrg = IamDatabase["iam"]["Tables"]["orgs"]["Row"]
export type IamOrgInsert = IamDatabase["iam"]["Tables"]["orgs"]["Insert"]
export type IamOrgMembership = IamDatabase["iam"]["Tables"]["org_memberships"]["Row"]
export type IamOrgMembershipInsert = IamDatabase["iam"]["Tables"]["org_memberships"]["Insert"]

// App Schema Types
export type AppDomain = AppDatabase["app"]["Tables"]["domains"]["Row"]
export type AppDomainInsert = AppDatabase["app"]["Tables"]["domains"]["Insert"]
export type AppDomainUpdate = AppDatabase["app"]["Tables"]["domains"]["Update"]
export type AppUserQuota = AppDatabase["app"]["Tables"]["user_quotas"]["Row"]
export type AppUserQuotaInsert = AppDatabase["app"]["Tables"]["user_quotas"]["Insert"]

// Export database client creators
export * from "./client"
