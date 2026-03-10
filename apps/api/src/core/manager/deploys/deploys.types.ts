import type {
  DeployArtifactKind,
  DeployDeploymentAction,
  DeployEnvironmentName,
  DeployExecutorBackend,
  DeployTaskStatus,
} from "@webalive/database"

export interface ManagerDeployBuild {
  build_id: string
  application_id: string
  status: DeployTaskStatus
  git_ref: string
  git_sha: string | null
  commit_message: string | null
  artifact_kind: DeployArtifactKind
  artifact_ref: string | null
  artifact_digest: string | null
  build_log_path: string | null
  error_message: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export interface ManagerDeployRelease {
  release_id: string
  application_id: string
  build_id: string
  git_sha: string
  commit_message: string | null
  artifact_kind: DeployArtifactKind
  artifact_ref: string
  artifact_digest: string
  created_at: string
  staging_status: DeployTaskStatus | null
  production_status: DeployTaskStatus | null
}

export interface ManagerDeployDeployment {
  deployment_id: string
  environment_id: string
  environment_name: DeployEnvironmentName
  environment_hostname: string
  environment_port: number | null
  release_id: string
  action: DeployDeploymentAction
  status: DeployTaskStatus
  deployment_log_path: string | null
  error_message: string | null
  healthcheck_status: number | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export interface ManagerDeployEnvironment {
  environment_id: string
  application_id: string
  name: DeployEnvironmentName
  hostname: string
  port: number | null
  executor: DeployExecutorBackend
  healthcheck_path: string
  allow_email: boolean
  current_deployment: ManagerDeployDeployment | null
}

export interface ManagerDeployApplication {
  application_id: string
  slug: string
  display_name: string
  repo_owner: string
  repo_name: string
  default_branch: string
  config_path: string
  environments: ManagerDeployEnvironment[]
  recent_builds: ManagerDeployBuild[]
  recent_releases: ManagerDeployRelease[]
  recent_deployments: ManagerDeployDeployment[]
}
