// Main database types file
// Imports and re-exports generated schema types
// DO NOT EDIT MANUALLY - Run 'bun run gen:types' to regenerate

// Import Database types for renaming
import type { Database as AppDatabase } from "./app.generated"
import type { Database as IamDatabase } from "./iam.generated"
import type { Database as IntegrationsDatabase } from "./integrations.generated"
import type { Database as LockboxDatabase } from "./lockbox.generated"
import type { Database as PublicDatabase } from "./public.generated"

// Export generated constants (runtime enum values derived from DB)
export { Constants as AppConstants } from "./app.generated"

// Export automation enum types, guards, and runtime sets
export {
  ACTION_TYPES,
  type ActionType,
  isActionType,
  isJobStatus,
  isRunStatus,
  isTriggerType,
  JOB_STATUSES,
  type JobStatus,
  RUN_STATUSES,
  type RunStatus,
  type TerminalRunStatus,
  TRIGGER_TYPES,
  type TriggerType,
} from "./automation-enums"

// Export common types from public schema (if available) or lockbox as fallback
export {
  CompositeTypes,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "./public.generated"

// Re-export with schema-specific names
export type { AppDatabase }
export type { IamDatabase }
export type { IntegrationsDatabase }
export type { LockboxDatabase }
export type { PublicDatabase }

// Re-export the main Database type for backward compatibility
export type Database = PublicDatabase

// Export database client creators
export * from "./client"
