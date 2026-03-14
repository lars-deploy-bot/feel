import { createReadStream } from "node:fs"
import { open, stat } from "node:fs/promises"
import path from "node:path"
import { createInterface } from "node:readline"
import {
  DEPLOY_DEPLOYMENT_ACTION_DEPLOY,
  DEPLOY_DEPLOYMENT_ACTION_PROMOTE,
  DEPLOY_ENVIRONMENT_PRODUCTION,
  DEPLOY_ENVIRONMENT_STAGING,
  type DeployDeploymentAction,
} from "@webalive/database"
import { deployRepo } from "../../../db/repos"
import { ConflictError, NotFoundError } from "../../../infra/errors"
import type {
  ManagerDeployApplication,
  ManagerDeployBuild,
  ManagerDeployDeployment,
  ManagerDeployEnvironment,
  ManagerDeployRelease,
} from "./deploys.types"

const DEPLOYER_DATA_DIR = process.env.ALIVE_DEPLOYER_DATA_DIR || "/var/lib/alive/deployer"
const LOG_TAIL_LINES = 400

function mapBuild(build: deployRepo.DeployBuildRow): ManagerDeployBuild {
  return {
    build_id: build.build_id,
    application_id: build.application_id,
    status: build.status,
    git_ref: build.git_ref,
    git_sha: build.git_sha,
    commit_message: build.commit_message,
    artifact_kind: build.artifact_kind,
    artifact_ref: build.artifact_ref,
    artifact_digest: build.artifact_digest,
    build_log_path: build.build_log_path,
    error_message: build.error_message,
    started_at: build.started_at,
    finished_at: build.finished_at,
    created_at: build.created_at,
  }
}

function mapDeployment(
  deployment: deployRepo.DeployDeploymentRow,
  environment: deployRepo.DeployEnvironmentRow,
): ManagerDeployDeployment {
  return {
    deployment_id: deployment.deployment_id,
    environment_id: deployment.environment_id,
    environment_name: environment.name,
    environment_hostname: environment.hostname,
    environment_port: environment.port,
    release_id: deployment.release_id,
    action: deployment.action,
    status: deployment.status,
    deployment_log_path: deployment.deployment_log_path,
    error_message: deployment.error_message,
    healthcheck_status: deployment.healthcheck_status,
    started_at: deployment.started_at,
    finished_at: deployment.finished_at,
    created_at: deployment.created_at,
  }
}

function mapEnvironment(
  environment: deployRepo.DeployEnvironmentRow,
  currentDeployment: ManagerDeployDeployment | null,
): ManagerDeployEnvironment {
  return {
    environment_id: environment.environment_id,
    application_id: environment.application_id,
    name: environment.name,
    hostname: environment.hostname,
    port: environment.port,
    executor: environment.executor,
    healthcheck_path: environment.healthcheck_path,
    allow_email: environment.allow_email,
    current_deployment: currentDeployment,
  }
}

async function readLogFile(logPath: string): Promise<string> {
  const absoluteLogPath = path.resolve(logPath)
  const absoluteDataDir = path.resolve(DEPLOYER_DATA_DIR)

  if (!absoluteLogPath.startsWith(`${absoluteDataDir}/`)) {
    throw new NotFoundError("Log file is outside the deployer data directory")
  }

  let fileHandle: Awaited<ReturnType<typeof open>> | null = null
  try {
    fileHandle = await open(absoluteLogPath, "r")
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new NotFoundError("Log file not found")
    }
    throw error
  }

  try {
    const ring: string[] = []
    const rl = createInterface({
      input: fileHandle.createReadStream({ encoding: "utf8" }),
      crlfDelay: Number.POSITIVE_INFINITY,
    })
    for await (const line of rl) {
      ring.push(line)
      if (ring.length > LOG_TAIL_LINES) {
        ring.shift()
      }
    }
    return ring.join("\n")
  } finally {
    await fileHandle.close()
  }
}

export async function listDeployApplications(): Promise<ManagerDeployApplication[]> {
  const applications = await deployRepo.findAllApplications()
  const applicationIds = applications.map(item => item.application_id)
  const environments = await deployRepo.findEnvironmentsByApplicationIds(applicationIds)
  const environmentIds = environments.map(item => item.environment_id)
  const builds = await deployRepo.findBuildsByApplicationIds(applicationIds)
  const releases = await deployRepo.findReleasesByApplicationIds(applicationIds)
  const deployments = await deployRepo.findDeploymentsByEnvironmentIds(environmentIds)

  const environmentsByApplication = new Map<string, deployRepo.DeployEnvironmentRow[]>()
  for (const environment of environments) {
    const list = environmentsByApplication.get(environment.application_id)
    if (list) {
      list.push(environment)
    } else {
      environmentsByApplication.set(environment.application_id, [environment])
    }
  }

  const latestDeploymentByEnvironment = deployRepo.selectLatestByEnvironment(deployments)
  const environmentsById = new Map(environments.map(item => [item.environment_id, item]))
  const releaseDeployments = deployRepo.selectLatestByReleaseAndEnvironment(deployments)

  const buildsByApplication = new Map<string, ManagerDeployBuild[]>()
  for (const build of builds) {
    const list = buildsByApplication.get(build.application_id)
    const mapped = mapBuild(build)
    if (list) {
      list.push(mapped)
    } else {
      buildsByApplication.set(build.application_id, [mapped])
    }
  }

  const releasesByApplication = new Map<string, ManagerDeployRelease[]>()
  for (const release of releases) {
    const deploymentsByEnvironment = releaseDeployments.get(release.release_id)
    const stagingDeployment = environments.find(
      environment =>
        environment.application_id === release.application_id && environment.name === DEPLOY_ENVIRONMENT_STAGING,
    )
    const productionDeployment = environments.find(
      environment =>
        environment.application_id === release.application_id && environment.name === DEPLOY_ENVIRONMENT_PRODUCTION,
    )

    const stagingStatus = stagingDeployment
      ? (deploymentsByEnvironment?.get(stagingDeployment.environment_id)?.status ?? null)
      : null
    const productionStatus = productionDeployment
      ? (deploymentsByEnvironment?.get(productionDeployment.environment_id)?.status ?? null)
      : null

    const mapped: ManagerDeployRelease = {
      release_id: release.release_id,
      application_id: release.application_id,
      build_id: release.build_id,
      git_sha: release.git_sha,
      commit_message: release.commit_message,
      artifact_kind: release.artifact_kind,
      artifact_ref: release.artifact_ref,
      artifact_digest: release.artifact_digest,
      created_at: release.created_at,
      staging_status: stagingStatus,
      production_status: productionStatus,
    }

    const list = releasesByApplication.get(release.application_id)
    if (list) {
      list.push(mapped)
    } else {
      releasesByApplication.set(release.application_id, [mapped])
    }
  }

  const deploymentsByApplication = new Map<string, ManagerDeployDeployment[]>()
  for (const deployment of deployments) {
    const environment = environmentsById.get(deployment.environment_id)
    if (!environment) {
      continue
    }

    const mapped = mapDeployment(deployment, environment)
    const list = deploymentsByApplication.get(environment.application_id)
    if (list) {
      list.push(mapped)
    } else {
      deploymentsByApplication.set(environment.application_id, [mapped])
    }
  }

  return applications.map(application => {
    const appEnvironments = environmentsByApplication.get(application.application_id) ?? []
    const mappedEnvironments = appEnvironments.map(environment => {
      const latestDeployment = latestDeploymentByEnvironment.get(environment.environment_id)
      const currentDeployment =
        latestDeployment && environmentsById.has(environment.environment_id)
          ? mapDeployment(latestDeployment, environment)
          : null

      return mapEnvironment(environment, currentDeployment)
    })

    return {
      application_id: application.application_id,
      slug: application.slug,
      display_name: application.display_name,
      repo_owner: application.repo_owner,
      repo_name: application.repo_name,
      default_branch: application.default_branch,
      config_path: application.config_path,
      environments: mappedEnvironments,
      recent_builds: buildsByApplication.get(application.application_id) ?? [],
      recent_releases: releasesByApplication.get(application.application_id) ?? [],
      recent_deployments: deploymentsByApplication.get(application.application_id) ?? [],
    }
  })
}

export async function queueBuild(applicationId: string, gitRef?: string): Promise<ManagerDeployBuild> {
  await deployRepo.findApplicationById(applicationId)
  const runningBuild = await deployRepo.findRunningBuildByApplicationId(applicationId)
  if (runningBuild) {
    throw new ConflictError("A build is already running for this application")
  }

  const build = await deployRepo.createBuild({
    application_id: applicationId,
    git_ref: gitRef?.trim() || "HEAD",
  })

  return mapBuild(build)
}

export async function queueDeployment(
  environmentId: string,
  releaseId: string,
  action?: DeployDeploymentAction,
): Promise<ManagerDeployDeployment> {
  const environment = await deployRepo.findEnvironmentById(environmentId)
  const release = await deployRepo.findReleaseById(releaseId)

  if (environment.application_id !== release.application_id) {
    throw new ConflictError("Release does not belong to the selected environment")
  }

  const runningDeployment = await deployRepo.findRunningDeploymentByEnvironmentId(environment.environment_id)
  if (runningDeployment) {
    throw new ConflictError("A deployment is already running for this environment")
  }

  const previousDeployment = await deployRepo.findLatestSuccessfulDeploymentForEnvironment(environment.environment_id)

  let promotedFromDeploymentId: string | null = null
  if (environment.name === DEPLOY_ENVIRONMENT_PRODUCTION) {
    const stagingEnvironment = await deployRepo.findEnvironmentByApplicationAndName(
      environment.application_id,
      DEPLOY_ENVIRONMENT_STAGING,
    )

    if (!stagingEnvironment) {
      throw new ConflictError("Production promotion requires a staging environment")
    }

    const successfulStagingDeployment = await deployRepo.findSuccessfulDeploymentForRelease(
      stagingEnvironment.environment_id,
      releaseId,
    )

    if (!successfulStagingDeployment) {
      throw new ConflictError("Production promotion requires a successful staging deployment of the same release")
    }

    promotedFromDeploymentId = successfulStagingDeployment.deployment_id
  }

  const resolvedAction =
    action ??
    (environment.name === DEPLOY_ENVIRONMENT_PRODUCTION
      ? DEPLOY_DEPLOYMENT_ACTION_PROMOTE
      : DEPLOY_DEPLOYMENT_ACTION_DEPLOY)

  const deployment = await deployRepo.createDeployment({
    environment_id: environment.environment_id,
    release_id: releaseId,
    action: resolvedAction,
    previous_deployment_id: previousDeployment?.deployment_id ?? null,
    promoted_from_deployment_id: promotedFromDeploymentId,
  })

  return mapDeployment(deployment, environment)
}

export async function readBuildLog(buildId: string): Promise<string> {
  const build = await deployRepo.findBuildById(buildId)
  if (!build.build_log_path) {
    throw new NotFoundError("Build log is not available yet")
  }

  return readLogFile(build.build_log_path)
}

export async function readDeploymentLog(deploymentId: string): Promise<string> {
  const deployment = await deployRepo.findDeploymentById(deploymentId)
  if (!deployment.deployment_log_path) {
    throw new NotFoundError("Deployment log is not available yet")
  }

  return readLogFile(deployment.deployment_log_path)
}
