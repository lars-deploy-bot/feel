import type { Database as DeployDatabase } from "./deploy.generated"
import { Constants as DeployConstants } from "./deploy.generated"

export type DeployArtifactKind = DeployDatabase["deploy"]["Enums"]["artifact_kind"]
export type DeployDeploymentAction = DeployDatabase["deploy"]["Enums"]["deployment_action"]
export type DeployEnvironmentName = DeployDatabase["deploy"]["Enums"]["environment_name"]
export type DeployExecutorBackend = DeployDatabase["deploy"]["Enums"]["executor_backend"]
export type DeployGitProvider = DeployDatabase["deploy"]["Enums"]["git_provider"]
export type DeployTaskStatus = DeployDatabase["deploy"]["Enums"]["task_status"]

export const DEPLOY_ARTIFACT_KINDS = DeployConstants.deploy.Enums.artifact_kind
export const DEPLOY_DEPLOYMENT_ACTIONS = DeployConstants.deploy.Enums.deployment_action
export const DEPLOY_ENVIRONMENT_NAMES = DeployConstants.deploy.Enums.environment_name
export const DEPLOY_EXECUTOR_BACKENDS = DeployConstants.deploy.Enums.executor_backend
export const DEPLOY_GIT_PROVIDERS = DeployConstants.deploy.Enums.git_provider
export const DEPLOY_TASK_STATUSES = DeployConstants.deploy.Enums.task_status

export const DEPLOY_ARTIFACT_KIND_SET: ReadonlySet<string> = new Set(DEPLOY_ARTIFACT_KINDS)
export const DEPLOY_DEPLOYMENT_ACTION_SET: ReadonlySet<string> = new Set(DEPLOY_DEPLOYMENT_ACTIONS)
export const DEPLOY_ENVIRONMENT_NAME_SET: ReadonlySet<string> = new Set(DEPLOY_ENVIRONMENT_NAMES)
export const DEPLOY_EXECUTOR_BACKEND_SET: ReadonlySet<string> = new Set(DEPLOY_EXECUTOR_BACKENDS)
export const DEPLOY_GIT_PROVIDER_SET: ReadonlySet<string> = new Set(DEPLOY_GIT_PROVIDERS)
export const DEPLOY_TASK_STATUS_SET: ReadonlySet<string> = new Set(DEPLOY_TASK_STATUSES)

export const DEPLOY_ARTIFACT_KIND_DOCKER_IMAGE: DeployArtifactKind = "docker_image"
export const DEPLOY_DEPLOYMENT_ACTION_DEPLOY: DeployDeploymentAction = "deploy"
export const DEPLOY_DEPLOYMENT_ACTION_PROMOTE: DeployDeploymentAction = "promote"
export const DEPLOY_DEPLOYMENT_ACTION_ROLLBACK: DeployDeploymentAction = "rollback"
export const DEPLOY_ENVIRONMENT_STAGING: DeployEnvironmentName = "staging"
export const DEPLOY_ENVIRONMENT_PRODUCTION: DeployEnvironmentName = "production"
export const DEPLOY_EXECUTOR_DOCKER: DeployExecutorBackend = "docker"
export const DEPLOY_GIT_PROVIDER_GITHUB: DeployGitProvider = "github"
export const DEPLOY_TASK_STATUS_PENDING: DeployTaskStatus = "pending"
export const DEPLOY_TASK_STATUS_RUNNING: DeployTaskStatus = "running"
export const DEPLOY_TASK_STATUS_SUCCEEDED: DeployTaskStatus = "succeeded"
export const DEPLOY_TASK_STATUS_FAILED: DeployTaskStatus = "failed"
export const DEPLOY_TASK_STATUS_CANCELLED: DeployTaskStatus = "cancelled"

export function isDeployArtifactKind(value: string): value is DeployArtifactKind {
  return DEPLOY_ARTIFACT_KIND_SET.has(value)
}

export function isDeployDeploymentAction(value: string): value is DeployDeploymentAction {
  return DEPLOY_DEPLOYMENT_ACTION_SET.has(value)
}

export function isDeployEnvironmentName(value: string): value is DeployEnvironmentName {
  return DEPLOY_ENVIRONMENT_NAME_SET.has(value)
}

export function isDeployExecutorBackend(value: string): value is DeployExecutorBackend {
  return DEPLOY_EXECUTOR_BACKEND_SET.has(value)
}

export function isDeployGitProvider(value: string): value is DeployGitProvider {
  return DEPLOY_GIT_PROVIDER_SET.has(value)
}

export function isDeployTaskStatus(value: string): value is DeployTaskStatus {
  return DEPLOY_TASK_STATUS_SET.has(value)
}
