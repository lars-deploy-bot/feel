import type { DeployDeploymentAction } from "@webalive/database"
import { api } from "@/lib/api"
import type { DeployApplication, DeployBuild, DeployDeployment } from "./deploys.types"

interface DeploysListResponse {
  data: DeployApplication[]
}

interface DeployBuildResponse {
  data: DeployBuild
}

interface DeployDeploymentResponse {
  data: DeployDeployment
}

async function fetchLog(url: string): Promise<string> {
  const response = await fetch(url, { credentials: "include" })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }))
    const message =
      typeof body.error === "string" ? body.error : (body.error?.message ?? `Request failed: ${response.status}`)
    throw new Error(message)
  }

  return response.text()
}

export const deploysApi = {
  list: () => api.get<DeploysListResponse>("/manager/deploys").then(response => response.data),
  build: (applicationId: string, gitRef?: string) =>
    api
      .post<DeployBuildResponse>("/manager/deploys/builds", {
        application_id: applicationId,
        git_ref: gitRef,
      })
      .then(response => response.data),
  deploy: (environmentId: string, releaseId: string, action?: DeployDeploymentAction) =>
    api
      .post<DeployDeploymentResponse>("/manager/deploys/deployments", {
        environment_id: environmentId,
        release_id: releaseId,
        action,
      })
      .then(response => response.data),
  getBuildLog: (buildId: string) => fetchLog(`/api/manager/deploys/builds/${buildId}/log`),
  getDeploymentLog: (deploymentId: string) => fetchLog(`/api/manager/deploys/deployments/${deploymentId}/log`),
}
