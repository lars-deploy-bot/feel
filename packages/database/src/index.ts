// Main database types file
// Imports and re-exports generated schema types
// DO NOT EDIT MANUALLY - Run 'bun run gen:types' to regenerate

// Import Database types for renaming
import type { Database as AppDatabase } from "./app.generated.js"
import type { Database as DeployDatabase } from "./deploy.generated.js"
import type { Database as IamDatabase } from "./iam.generated.js"
import type { Database as IntegrationsDatabase } from "./integrations.generated.js"
import type { Database as LockboxDatabase } from "./lockbox.generated.js"
import type { Database as PublicDatabase } from "./public.generated.js"

// Export generated constants (runtime enum values derived from DB)
export { Constants as AppConstants } from "./app.generated.js"
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
} from "./automation-enums.js"
export { Constants as DeployConstants } from "./deploy.generated.js"
export type {
  // Row types
  ApplicationRow as DeployApplicationRow,
  BuildRow as DeployBuildRow,
  // Enum types
  DeployArtifactKind,
  DeployDeploymentAction,
  DeployEnvironmentName,
  DeployExecutorBackend,
  // Pipeline / health types
  DeployerBuildStage,
  DeployerDeploymentStage,
  DeployerHealthResponse,
  DeployerWorkerStatus,
  DeployGitProvider,
  DeploymentRow as DeployDeploymentRow,
  DeployTaskStatus,
  EnvironmentRow as DeployEnvironmentRow,
  ReleaseRow as DeployReleaseRow,
} from "./deploy-contract.js"
// Deploy contract — single source of truth for the entire deploy pipeline
export {
  // Zod schemas (API routes MUST use these, not define their own)
  ApplicationZ,
  ArtifactKindZ,
  BuildZ,
  CreateBuildBodyZ,
  CreateDeploymentBodyZ,
  // Enum runtime values
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
  // Pipeline stages
  DEPLOYER_BUILD_STAGES,
  DEPLOYER_DEPLOYMENT_STAGES,
  DEPLOYER_WORKER_STATUSES,
  DeployerHealthZ,
  DeploymentActionZ,
  DeploymentZ,
  EnvironmentNameZ,
  EnvironmentZ,
  ExecutorBackendZ,
  // Type guards
  isDeployArtifactKind,
  isDeployDeploymentAction,
  isDeployEnvironmentName,
  isDeployExecutorBackend,
  isDeployGitProvider,
  isDeployTaskStatus,
  ReleaseZ,
  TaskStatusZ,
} from "./deploy-contract.js"

// Export common types from public schema (if available) or lockbox as fallback
export {
  CompositeTypes,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "./public.generated.js"
// Re-export with schema-specific names
export type { AppDatabase, DeployDatabase, IamDatabase, IntegrationsDatabase, LockboxDatabase, PublicDatabase }

// Re-export the main Database type for backward compatibility
export type Database = PublicDatabase

// Export database client creators
export * from "./client.js"

// Export startup verification (schema + server identity)
export {
  checkSchema,
  ensureServerRow,
  formatSchemaFailure,
  formatServerCheckFailure,
  type ServerIdentity,
} from "./seed-check.js"
