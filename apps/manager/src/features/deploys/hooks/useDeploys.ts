import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { DEPLOY_TASK_STATUS_PENDING, DEPLOY_TASK_STATUS_RUNNING, type DeployDeploymentAction } from "@webalive/database"
import toast from "react-hot-toast"
import { deploysApi } from "../deploys.api"
import type { DeployApplication } from "../deploys.types"

const DEPLOYS_KEY: readonly ["deploys"] = ["deploys"]

function hasInFlightWork(applications: DeployApplication[] | undefined): boolean {
  if (!applications) {
    return false
  }

  return applications.some(application => {
    const hasRunningBuild = application.recent_builds.some(
      build => build.status === DEPLOY_TASK_STATUS_PENDING || build.status === DEPLOY_TASK_STATUS_RUNNING,
    )
    const hasRunningDeployment = application.recent_deployments.some(
      deployment =>
        deployment.status === DEPLOY_TASK_STATUS_PENDING || deployment.status === DEPLOY_TASK_STATUS_RUNNING,
    )
    return hasRunningBuild || hasRunningDeployment
  })
}

export function useDeploys() {
  const queryClient = useQueryClient()
  const {
    data: applications = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: DEPLOYS_KEY,
    queryFn: deploysApi.list,
    staleTime: 5_000,
    refetchInterval: query => (hasInFlightWork(query.state.data) ? 5_000 : false),
  })

  const buildMutation = useMutation({
    mutationFn: ({ applicationId, gitRef }: { applicationId: string; gitRef?: string }) =>
      deploysApi.build(applicationId, gitRef),
    onSuccess: () => {
      toast.success("Build queued")
      queryClient.invalidateQueries({ queryKey: DEPLOYS_KEY })
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : "Failed to queue build")
    },
  })

  const deploymentMutation = useMutation({
    mutationFn: ({
      environmentId,
      releaseId,
      action,
    }: {
      environmentId: string
      releaseId: string
      action?: DeployDeploymentAction
    }) => deploysApi.deploy(environmentId, releaseId, action),
    onSuccess: () => {
      toast.success("Deployment queued")
      queryClient.invalidateQueries({ queryKey: DEPLOYS_KEY })
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : "Failed to queue deployment")
    },
  })

  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to load deploys") : null

  const buildingApplicationId =
    buildMutation.isPending && buildMutation.variables ? buildMutation.variables.applicationId : null

  const deployingKey =
    deploymentMutation.isPending && deploymentMutation.variables
      ? `${deploymentMutation.variables.environmentId}:${deploymentMutation.variables.releaseId}`
      : null

  return {
    applications,
    loading,
    error,
    refresh: () => refetch(),
    queueBuild: (applicationId: string, gitRef?: string) => buildMutation.mutateAsync({ applicationId, gitRef }),
    queueDeployment: (environmentId: string, releaseId: string, action?: DeployDeploymentAction) =>
      deploymentMutation.mutateAsync({ environmentId, releaseId, action }),
    buildingApplicationId,
    deployingKey,
  }
}
