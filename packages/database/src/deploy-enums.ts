import { Constants as DeployConstants } from "./deploy.generated"
import type { Database as DeployDatabase } from "./deploy.generated"

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
export const DEPLOY_ARTIFACT_KIND_DOCKER_IMAGE = DEPLOY_ARTIFACT_KINDS[0]
export const DEPLOY_DEPLOYMENT_ACTION_DEPLOY = DEPLOY_DEPLOYMENT_ACTIONS[0]
export const DEPLOY_DEPLOYMENT_ACTION_PROMOTE = DEPLOY_DEPLOYMENT_ACTIONS[1]
export const DEPLOY_DEPLOYMENT_ACTION_ROLLBACK = DEPLOY_DEPLOYMENT_ACTIONS[2]
export const DEPLOY_ENVIRONMENT_STAGING = DEPLOY_ENVIRONMENT_NAMES[0]
export const DEPLOY_ENVIRONMENT_PRODUCTION = DEPLOY_ENVIRONMENT_NAMES[1]
export const DEPLOY_EXECUTOR_DOCKER = DEPLOY_EXECUTOR_BACKENDS[0]
export const DEPLOY_GIT_PROVIDER_GITHUB = DEPLOY_GIT_PROVIDERS[0]
export const DEPLOY_TASK_STATUS_PENDING = DEPLOY_TASK_STATUSES[0]
export const DEPLOY_TASK_STATUS_RUNNING = DEPLOY_TASK_STATUSES[1]
export const DEPLOY_TASK_STATUS_SUCCEEDED = DEPLOY_TASK_STATUSES[2]
export const DEPLOY_TASK_STATUS_FAILED = DEPLOY_TASK_STATUSES[3]
export const DEPLOY_TASK_STATUS_CANCELLED = DEPLOY_TASK_STATUSES[4]

function includesString<T extends string>(values: readonly T[], value: string): value is T {
  return values.some(item => item === value)
}

export function isDeployArtifactKind(value: string): value is DeployArtifactKind {
  return includesString(DEPLOY_ARTIFACT_KINDS, value)
}

export function isDeployDeploymentAction(value: string): value is DeployDeploymentAction {
  return includesString(DEPLOY_DEPLOYMENT_ACTIONS, value)
}

export function isDeployEnvironmentName(value: string): value is DeployEnvironmentName {
  return includesString(DEPLOY_ENVIRONMENT_NAMES, value)
}

export function isDeployExecutorBackend(value: string): value is DeployExecutorBackend {
  return includesString(DEPLOY_EXECUTOR_BACKENDS, value)
}

export function isDeployGitProvider(value: string): value is DeployGitProvider {
  return includesString(DEPLOY_GIT_PROVIDERS, value)
}

export function isDeployTaskStatus(value: string): value is DeployTaskStatus {
  return includesString(DEPLOY_TASK_STATUSES, value)
}
