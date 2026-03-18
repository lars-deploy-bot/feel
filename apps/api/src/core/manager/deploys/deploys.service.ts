import { open } from "node:fs/promises"
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

const DEPLOYER_DATA_DIR = "/var/lib/alive/deployer"
const DEPLOYER_URL = "http://127.0.0.1:5095"
const LOG_TAIL_LINES = 400
const BUILD_POLL_INTERVAL_MS = 2_000
const BUILD_TIMEOUT_MS = 600_000
const DEPLOY_POLL_INTERVAL_MS = 2_000
const DEPLOY_TIMEOUT_MS = 300_000

/** Notify deployer-rs to check for pending work immediately. Best-effort — never throws. */
async function pokeDeployer(): Promise<void> {
  try {
    await fetch(`${DEPLOYER_URL}/poke`, { method: "POST", signal: AbortSignal.timeout(2_000) })
  } catch {
    // Non-fatal — deployer will poll on its own within 5s
  }
}

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

  await pokeDeployer()
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

  await pokeDeployer()
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

// =============================================================================
// Ship pipeline — full build → deploy orchestration
// =============================================================================

export interface ShipResult {
  build: ManagerDeployBuild
  release_id: string
  deployment: ManagerDeployDeployment
}

/**
 * Full build → deploy pipeline. This is the API equivalent of `deploy-via-deployer.sh`.
 *
 * 1. Queue build → poke deployer → poll until succeeded
 * 2. Resolve release from build
 * 3. Queue deployment → poke deployer → poll until succeeded
 *
 * Returns the final build, release, and deployment.
 * Throws on any failure (build failed, deployment failed, timeout).
 */
export async function shipPipeline(
  applicationId: string,
  environmentName: string,
  gitRef?: string,
): Promise<ShipResult> {
  // 1. Queue build
  const build = await queueBuild(applicationId, gitRef)

  // 2. Wait for build to complete
  const completedBuild = await pollBuildUntilDone(build.build_id)
  if (completedBuild.status !== "succeeded") {
    throw new ConflictError(`Build failed: ${completedBuild.error_message ?? "unknown error"}`)
  }

  // 3. Resolve release
  const release = await deployRepo.findReleaseByBuildId(completedBuild.build_id)
  if (!release) {
    throw new NotFoundError(`No release found for build ${completedBuild.build_id}`)
  }

  // 4. Resolve environment
  const application = await deployRepo.findApplicationById(applicationId)
  const environments = await deployRepo.findEnvironmentsByApplicationIds([application.application_id])
  const environment = environments.find(e => e.name === environmentName)
  if (!environment) {
    throw new NotFoundError(`No environment '${environmentName}' found for application ${applicationId}`)
  }

  // 5. Queue deployment
  const deployment = await queueDeployment(environment.environment_id, release.release_id)

  // 6. Wait for deployment to complete
  const completedDeployment = await pollDeploymentUntilDone(deployment.deployment_id, environment)
  if (completedDeployment.status !== "succeeded") {
    throw new ConflictError(`Deployment failed: ${completedDeployment.error_message ?? "unknown error"}`)
  }

  return {
    build: completedBuild,
    release_id: release.release_id,
    deployment: completedDeployment,
  }
}

async function pollBuildUntilDone(buildId: string): Promise<ManagerDeployBuild> {
  const deadline = Date.now() + BUILD_TIMEOUT_MS
  while (Date.now() < deadline) {
    const build = await deployRepo.findBuildById(buildId)
    if (build.status === "succeeded" || build.status === "failed") {
      return mapBuild(build)
    }
    await new Promise(resolve => setTimeout(resolve, BUILD_POLL_INTERVAL_MS))
  }
  throw new ConflictError(`Build ${buildId} timed out after ${BUILD_TIMEOUT_MS / 1000}s`)
}

async function pollDeploymentUntilDone(
  deploymentId: string,
  environment: deployRepo.DeployEnvironmentRow,
): Promise<ManagerDeployDeployment> {
  const deadline = Date.now() + DEPLOY_TIMEOUT_MS
  while (Date.now() < deadline) {
    const deployment = await deployRepo.findDeploymentById(deploymentId)
    if (deployment.status === "succeeded" || deployment.status === "failed") {
      return mapDeployment(deployment, environment)
    }
    await new Promise(resolve => setTimeout(resolve, DEPLOY_POLL_INTERVAL_MS))
  }
  throw new ConflictError(`Deployment ${deploymentId} timed out after ${DEPLOY_TIMEOUT_MS / 1000}s`)
}
