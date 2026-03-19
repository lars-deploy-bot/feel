import type { DeployDatabase, DeployEnvironmentName } from "@webalive/database"
import { DEPLOY_TASK_STATUS_RUNNING, DEPLOY_TASK_STATUS_SUCCEEDED } from "@webalive/database"
import { ConflictError, InternalError, NotFoundError } from "../../infra/errors"
import { deploy } from "../clients"

export type DeployApplicationRow = DeployDatabase["deploy"]["Tables"]["applications"]["Row"]
export type DeployBuildInsert = DeployDatabase["deploy"]["Tables"]["builds"]["Insert"]
export type DeployBuildRow = DeployDatabase["deploy"]["Tables"]["builds"]["Row"]
export type DeployDeploymentInsert = DeployDatabase["deploy"]["Tables"]["deployments"]["Insert"]
export type DeployDeploymentRow = DeployDatabase["deploy"]["Tables"]["deployments"]["Row"]
export type DeployEnvironmentRow = DeployDatabase["deploy"]["Tables"]["environments"]["Row"]
export type DeployReleaseRow = DeployDatabase["deploy"]["Tables"]["releases"]["Row"]

function formatDeployError(context: string, message: string): InternalError {
  return new InternalError(`Failed to ${context}: ${message}`)
}

function isUniqueConflict(code: string | null): boolean {
  return code === "23505"
}

export async function findAllApplications(): Promise<DeployApplicationRow[]> {
  const { data, error } = await deploy.from("applications").select("*").order("display_name")

  if (error) {
    throw formatDeployError("fetch deploy applications", error.message)
  }

  return data ?? []
}

export async function findApplicationById(applicationId: string): Promise<DeployApplicationRow> {
  const { data, error } = await deploy
    .from("applications")
    .select("*")
    .eq("application_id", applicationId)
    .maybeSingle()

  if (error) {
    throw formatDeployError(`fetch application ${applicationId}`, error.message)
  }

  if (!data) {
    throw new NotFoundError(`Deploy application ${applicationId} not found`)
  }

  return data
}

export async function findEnvironmentsByApplicationIds(applicationIds: string[]): Promise<DeployEnvironmentRow[]> {
  if (applicationIds.length === 0) {
    return []
  }

  const { data, error } = await deploy
    .from("environments")
    .select("*")
    .in("application_id", applicationIds)
    .order("created_at", { ascending: false })

  if (error) {
    throw formatDeployError("fetch deploy environments", error.message)
  }

  return data ?? []
}

export async function findEnvironmentById(environmentId: string): Promise<DeployEnvironmentRow> {
  const { data, error } = await deploy
    .from("environments")
    .select("*")
    .eq("environment_id", environmentId)
    .maybeSingle()

  if (error) {
    throw formatDeployError(`fetch environment ${environmentId}`, error.message)
  }

  if (!data) {
    throw new NotFoundError(`Deploy environment ${environmentId} not found`)
  }

  return data
}

export async function findEnvironmentByApplicationAndName(
  applicationId: string,
  name: DeployEnvironmentName,
  serverId?: string,
): Promise<DeployEnvironmentRow | null> {
  let query = deploy.from("environments").select("*").eq("application_id", applicationId).eq("name", name)
  if (serverId) {
    query = query.eq("server_id", serverId)
  }
  const { data, error } = await query.maybeSingle()

  if (error) {
    throw formatDeployError(`fetch ${name} environment for application ${applicationId}`, error.message)
  }

  return data
}

export async function findBuildsByApplicationIds(applicationIds: string[], limit = 20): Promise<DeployBuildRow[]> {
  if (applicationIds.length === 0) {
    return []
  }

  const { data, error } = await deploy
    .from("builds")
    .select("*")
    .in("application_id", applicationIds)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw formatDeployError("fetch deploy builds", error.message)
  }

  return data ?? []
}

export async function findBuildById(buildId: string): Promise<DeployBuildRow> {
  const { data, error } = await deploy.from("builds").select("*").eq("build_id", buildId).maybeSingle()

  if (error) {
    throw formatDeployError(`fetch build ${buildId}`, error.message)
  }

  if (!data) {
    throw new NotFoundError(`Deploy build ${buildId} not found`)
  }

  return data
}

export async function findReleasesByApplicationIds(applicationIds: string[], limit = 20): Promise<DeployReleaseRow[]> {
  if (applicationIds.length === 0) {
    return []
  }

  const { data, error } = await deploy
    .from("releases")
    .select("*")
    .in("application_id", applicationIds)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw formatDeployError("fetch deploy releases", error.message)
  }

  return data ?? []
}

export async function findReleaseById(releaseId: string): Promise<DeployReleaseRow> {
  const { data, error } = await deploy.from("releases").select("*").eq("release_id", releaseId).maybeSingle()

  if (error) {
    throw formatDeployError(`fetch release ${releaseId}`, error.message)
  }

  if (!data) {
    throw new NotFoundError(`Deploy release ${releaseId} not found`)
  }

  return data
}

export async function findReleaseByBuildId(buildId: string): Promise<DeployReleaseRow | null> {
  const { data, error } = await deploy
    .from("releases")
    .select("*")
    .eq("build_id", buildId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw formatDeployError(`fetch release for build ${buildId}`, error.message)
  }

  return data
}

export async function findDeploymentsByEnvironmentIds(
  environmentIds: string[],
  limit = 30,
): Promise<DeployDeploymentRow[]> {
  if (environmentIds.length === 0) {
    return []
  }

  const { data, error } = await deploy
    .from("deployments")
    .select("*")
    .in("environment_id", environmentIds)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw formatDeployError("fetch deploy deployments", error.message)
  }

  return data ?? []
}

export async function findDeploymentById(deploymentId: string): Promise<DeployDeploymentRow> {
  const { data, error } = await deploy.from("deployments").select("*").eq("deployment_id", deploymentId).maybeSingle()

  if (error) {
    throw formatDeployError(`fetch deployment ${deploymentId}`, error.message)
  }

  if (!data) {
    throw new NotFoundError(`Deploy deployment ${deploymentId} not found`)
  }

  return data
}

export async function findRunningBuildByApplicationId(applicationId: string): Promise<DeployBuildRow | null> {
  const { data, error } = await deploy
    .from("builds")
    .select("*")
    .eq("application_id", applicationId)
    .eq("status", DEPLOY_TASK_STATUS_RUNNING)
    .maybeSingle()

  if (error) {
    throw formatDeployError(`fetch running build for application ${applicationId}`, error.message)
  }

  return data
}

export async function findRunningDeploymentByEnvironmentId(environmentId: string): Promise<DeployDeploymentRow | null> {
  const { data, error } = await deploy
    .from("deployments")
    .select("*")
    .eq("environment_id", environmentId)
    .eq("status", DEPLOY_TASK_STATUS_RUNNING)
    .maybeSingle()

  if (error) {
    throw formatDeployError(`fetch running deployment for environment ${environmentId}`, error.message)
  }

  return data
}

export async function findLatestSuccessfulDeploymentForEnvironment(
  environmentId: string,
): Promise<DeployDeploymentRow | null> {
  const { data, error } = await deploy
    .from("deployments")
    .select("*")
    .eq("environment_id", environmentId)
    .eq("status", DEPLOY_TASK_STATUS_SUCCEEDED)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw formatDeployError(`fetch latest successful deployment for environment ${environmentId}`, error.message)
  }

  return data
}

export async function findSuccessfulDeploymentForRelease(
  environmentId: string,
  releaseId: string,
): Promise<DeployDeploymentRow | null> {
  const { data, error } = await deploy
    .from("deployments")
    .select("*")
    .eq("environment_id", environmentId)
    .eq("release_id", releaseId)
    .eq("status", DEPLOY_TASK_STATUS_SUCCEEDED)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw formatDeployError(
      `fetch successful deployment for environment ${environmentId} and release ${releaseId}`,
      error.message,
    )
  }

  return data
}

export async function createBuild(build: DeployBuildInsert): Promise<DeployBuildRow> {
  const { data, error } = await deploy.from("builds").insert(build).select("*").single()

  if (error) {
    if (isUniqueConflict(error.code)) {
      throw new ConflictError("A build is already running for this application")
    }
    throw formatDeployError("create deploy build", error.message)
  }

  return data
}

export async function createDeployment(deploymentRow: DeployDeploymentInsert): Promise<DeployDeploymentRow> {
  const { data, error } = await deploy.from("deployments").insert(deploymentRow).select("*").single()

  if (error) {
    if (isUniqueConflict(error.code)) {
      throw new ConflictError("A deployment is already running for this environment")
    }
    throw formatDeployError("create deployment", error.message)
  }

  return data
}

export function selectLatestByReleaseAndEnvironment(
  deployments: DeployDeploymentRow[],
): Map<string, Map<string, DeployDeploymentRow>> {
  const releaseMap = new Map<string, Map<string, DeployDeploymentRow>>()

  for (const item of deployments) {
    const envMap = releaseMap.get(item.release_id)
    if (envMap) {
      if (!envMap.has(item.environment_id)) {
        envMap.set(item.environment_id, item)
      }
      continue
    }

    const next = new Map<string, DeployDeploymentRow>()
    next.set(item.environment_id, item)
    releaseMap.set(item.release_id, next)
  }

  return releaseMap
}

export function selectLatestByEnvironment(deployments: DeployDeploymentRow[]): Map<string, DeployDeploymentRow> {
  const environmentMap = new Map<string, DeployDeploymentRow>()

  for (const item of deployments) {
    if (!environmentMap.has(item.environment_id)) {
      environmentMap.set(item.environment_id, item)
    }
  }

  return environmentMap
}
