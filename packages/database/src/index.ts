// Main database types file
// Imports and re-exports generated schema types
// DO NOT EDIT MANUALLY - Run 'bun run gen:types' to regenerate

// Import Database types for renaming
import type { Database as AppDatabase } from "./app.generated"
import type { Database as DeployDatabase } from "./deploy.generated"
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
  EXECUTION_MODES,
  type ExecutionMode,
  isActionType,
  isExecutionMode,
  isJobStatus,
  isRunStatus,
  isSandboxStatus,
  isTriggerType,
  JOB_STATUSES,
  type JobStatus,
  RUN_STATUSES,
  type RunStatus,
  SANDBOX_STATUSES,
  type SandboxStatus,
  type TerminalRunStatus,
  TRIGGER_TYPES,
  type TriggerType,
} from "./automation-enums"
export { Constants as DeployConstants } from "./deploy.generated"
export {
  DEPLOY_ARTIFACT_KIND_DOCKER_IMAGE,
  DEPLOY_ARTIFACT_KINDS,
  DEPLOY_DEPLOYMENT_ACTION_DEPLOY,
  DEPLOY_DEPLOYMENT_ACTION_PROMOTE,
  DEPLOY_DEPLOYMENT_ACTION_ROLLBACK,
  DEPLOY_DEPLOYMENT_ACTIONS,
  DEPLOY_ENVIRONMENT_NAMES,
  DEPLOY_ENVIRONMENT_PRODUCTION,
  DEPLOY_ENVIRONMENT_STAGING,
  DEPLOY_EXECUTOR_BACKENDS,
  DEPLOY_EXECUTOR_DOCKER,
  DEPLOY_GIT_PROVIDER_GITHUB,
  DEPLOY_GIT_PROVIDERS,
  DEPLOY_TASK_STATUS_CANCELLED,
  DEPLOY_TASK_STATUS_FAILED,
  DEPLOY_TASK_STATUS_PENDING,
  DEPLOY_TASK_STATUS_RUNNING,
  DEPLOY_TASK_STATUS_SUCCEEDED,
  DEPLOY_TASK_STATUSES,
  type DeployArtifactKind,
  type DeployDeploymentAction,
  type DeployEnvironmentName,
  type DeployExecutorBackend,
  type DeployGitProvider,
  type DeployTaskStatus,
  isDeployArtifactKind,
  isDeployDeploymentAction,
  isDeployEnvironmentName,
  isDeployExecutorBackend,
  isDeployGitProvider,
  isDeployTaskStatus,
} from "./deploy-enums"

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
export type { DeployDatabase }
export type { IamDatabase }
export type { IntegrationsDatabase }
export type { LockboxDatabase }
export type { PublicDatabase }

// Re-export the main Database type for backward compatibility
export type Database = PublicDatabase

// Export database client creators
export * from "./client"

// Export startup verification (schema + server identity)
export {
  checkSchema,
  ensureServerRow,
  formatSchemaFailure,
  formatServerCheckFailure,
  type ServerIdentity,
} from "./seed-check"
