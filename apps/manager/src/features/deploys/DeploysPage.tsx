import {
  DEPLOY_DEPLOYMENT_ACTION_DEPLOY,
  DEPLOY_DEPLOYMENT_ACTION_PROMOTE,
  DEPLOY_ENVIRONMENT_PRODUCTION,
  DEPLOY_TASK_STATUS_CANCELLED,
  DEPLOY_TASK_STATUS_FAILED,
  DEPLOY_TASK_STATUS_PENDING,
  DEPLOY_TASK_STATUS_RUNNING,
  DEPLOY_TASK_STATUS_SUCCEEDED,
  type DeployDeploymentAction,
  type DeployTaskStatus,
} from "@webalive/database"
import { useEffect, useState } from "react"
import { EmptyState } from "@/components/data/EmptyState"
import { PageHeader } from "@/components/layout/PageHeader"
import { Modal } from "@/components/overlays/Modal"
import { Badge, type BadgeVariant } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Spinner } from "@/components/ui/Spinner"
import { cn } from "@/lib/cn"
import { deploysApi } from "./deploys.api"
import { useDeploys } from "./hooks/useDeploys"
import type { DeployApplication, DeployEnvironment, DeployRelease } from "./deploys.types"

interface LogModalState {
  kind: "build" | "deployment"
  id: string
  title: string
}

function formatWhen(value: string | null): string {
  if (!value) {
    return "—"
  }

  return new Date(value).toLocaleString()
}

function shortDigest(value: string | null): string {
  if (!value) {
    return "—"
  }

  return value.length > 18 ? `${value.slice(0, 18)}…` : value
}

function statusVariant(status: DeployTaskStatus | null): BadgeVariant {
  if (status === DEPLOY_TASK_STATUS_SUCCEEDED) {
    return "success"
  }
  if (status === DEPLOY_TASK_STATUS_FAILED) {
    return "danger"
  }
  if (status === DEPLOY_TASK_STATUS_PENDING || status === DEPLOY_TASK_STATUS_RUNNING) {
    return "accent"
  }
  if (status === DEPLOY_TASK_STATUS_CANCELLED) {
    return "warning"
  }
  return "default"
}

function deploymentButtonLabel(name: DeployEnvironment["name"]): string {
  return name === DEPLOY_ENVIRONMENT_PRODUCTION ? "Promote to production" : "Promote to staging"
}

function deploymentButtonAction(name: DeployEnvironment["name"]): DeployDeploymentAction {
  return name === DEPLOY_ENVIRONMENT_PRODUCTION ? DEPLOY_DEPLOYMENT_ACTION_PROMOTE : DEPLOY_DEPLOYMENT_ACTION_DEPLOY
}

function releaseStatusForEnvironment(release: DeployRelease, environment: DeployEnvironment): DeployTaskStatus | null {
  return environment.name === DEPLOY_ENVIRONMENT_PRODUCTION ? release.production_status : release.staging_status
}

function EnvironmentCard({ environment }: { environment: DeployEnvironment }) {
  const currentDeployment = environment.current_deployment

  return (
    <div className="rounded-card border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold text-text-primary capitalize">{environment.name}</h3>
            <Badge variant={environment.allow_email ? "success" : "warning"}>
              {environment.allow_email ? "Email allowed" : "Email blocked"}
            </Badge>
          </div>
          <p className="mt-1 text-[12px] text-text-tertiary">
            {environment.hostname}
            {environment.port ? `:${environment.port}` : ""}
          </p>
        </div>
        <Badge variant="default">{environment.executor}</Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">Health</p>
          <p className="mt-1 text-[12px] text-text-primary">{environment.healthcheck_path}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">Current deployment</p>
          {currentDeployment ? (
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={statusVariant(currentDeployment.status)}>{currentDeployment.status}</Badge>
              <span className="text-[12px] text-text-tertiary">{formatWhen(currentDeployment.created_at)}</span>
            </div>
          ) : (
            <p className="mt-1 text-[12px] text-text-tertiary">No deployments yet</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ReleasesSection({
  application,
  queueDeployment,
  deployingKey,
  onViewLog,
}: {
  application: DeployApplication
  queueDeployment: (environmentId: string, releaseId: string, action?: DeployDeploymentAction) => Promise<unknown>
  deployingKey: string | null
  onViewLog: (state: LogModalState) => void
}) {
  if (application.recent_releases.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border p-5">
        <p className="text-[13px] text-text-tertiary">
          No releases yet. Build this app to produce the first immutable artifact.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-card border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-secondary/60">
        <h3 className="text-[13px] font-semibold text-text-primary">Releases</h3>
      </div>
      <div className="divide-y divide-border">
        {application.recent_releases.map(release => (
          <div key={release.release_id} className="px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default">{release.artifact_kind}</Badge>
                  <Badge variant={statusVariant(release.staging_status)}>
                    staging: {release.staging_status ?? "—"}
                  </Badge>
                  <Badge variant={statusVariant(release.production_status)}>
                    production: {release.production_status ?? "—"}
                  </Badge>
                </div>
                <p className="mt-2 text-[13px] font-medium text-text-primary">{shortDigest(release.artifact_digest)}</p>
                <p className="mt-1 text-[12px] text-text-tertiary">{release.commit_message ?? release.git_sha}</p>
                <p className="mt-1 text-[12px] text-text-tertiary">
                  Created {formatWhen(release.created_at)} from build {release.build_id}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {application.environments.map(environment => {
                  const buttonKey = `${environment.environment_id}:${release.release_id}`
                  const loading = deployingKey === buttonKey
                  const currentStatus = releaseStatusForEnvironment(release, environment)
                  return (
                    <Button
                      key={buttonKey}
                      size="sm"
                      variant={environment.name === DEPLOY_ENVIRONMENT_PRODUCTION ? "secondary" : "primary"}
                      loading={loading}
                      onClick={() =>
                        queueDeployment(
                          environment.environment_id,
                          release.release_id,
                          deploymentButtonAction(environment.name),
                        )
                      }
                      disabled={currentStatus === DEPLOY_TASK_STATUS_RUNNING}
                    >
                      {deploymentButtonLabel(environment.name)}
                    </Button>
                  )
                })}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    onViewLog({
                      kind: "build",
                      id: release.build_id,
                      title: `Build log for ${release.build_id}`,
                    })
                  }
                >
                  View build log
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BuildsSection({
  application,
  buildingApplicationId,
  queueBuild,
  onViewLog,
}: {
  application: DeployApplication
  buildingApplicationId: string | null
  queueBuild: (applicationId: string, gitRef?: string) => Promise<unknown>
  onViewLog: (state: LogModalState) => void
}) {
  const loading = buildingApplicationId === application.application_id

  return (
    <div className="rounded-card border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-secondary/60 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-text-primary">Builds</h3>
          <p className="mt-1 text-[12px] text-text-tertiary">
            Builds use the current repo `HEAD` and create an immutable Docker artifact.
          </p>
        </div>
        <Button size="sm" variant="primary" loading={loading} onClick={() => queueBuild(application.application_id)}>
          Build
        </Button>
      </div>
      <div className="divide-y divide-border">
        {application.recent_builds.length === 0 ? (
          <div className="px-4 py-5 text-[12px] text-text-tertiary">No builds yet</div>
        ) : (
          application.recent_builds.map(build => (
            <div
              key={build.build_id}
              className="px-4 py-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(build.status)}>{build.status}</Badge>
                  <span className="text-[12px] text-text-tertiary">{build.git_ref}</span>
                </div>
                <p className="mt-2 text-[13px] text-text-primary">
                  {build.commit_message ?? build.git_sha ?? "Git resolution pending"}
                </p>
                <p className="mt-1 text-[12px] text-text-tertiary">
                  Created {formatWhen(build.created_at)}
                  {build.finished_at ? ` · finished ${formatWhen(build.finished_at)}` : ""}
                </p>
                {build.error_message && <p className="mt-1 text-[12px] text-danger">{build.error_message}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    onViewLog({
                      kind: "build",
                      id: build.build_id,
                      title: `Build log for ${build.build_id}`,
                    })
                  }
                >
                  View log
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function DeploymentsSection({
  application,
  onViewLog,
}: {
  application: DeployApplication
  onViewLog: (state: LogModalState) => void
}) {
  return (
    <div className="rounded-card border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-secondary/60">
        <h3 className="text-[13px] font-semibold text-text-primary">Deployments</h3>
      </div>
      <div className="divide-y divide-border">
        {application.recent_deployments.length === 0 ? (
          <div className="px-4 py-5 text-[12px] text-text-tertiary">No deployments yet</div>
        ) : (
          application.recent_deployments.map(deployment => (
            <div
              key={deployment.deployment_id}
              className="px-4 py-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(deployment.status)}>{deployment.status}</Badge>
                  <Badge variant="default" className="capitalize">
                    {deployment.environment_name}
                  </Badge>
                  <Badge variant="default">{deployment.action}</Badge>
                </div>
                <p className="mt-2 text-[13px] text-text-primary">Release {shortDigest(deployment.release_id)}</p>
                <p className="mt-1 text-[12px] text-text-tertiary">
                  {deployment.environment_hostname}
                  {deployment.environment_port ? `:${deployment.environment_port}` : ""}
                  {" · "}
                  started {formatWhen(deployment.started_at ?? deployment.created_at)}
                </p>
                {deployment.error_message && <p className="mt-1 text-[12px] text-danger">{deployment.error_message}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    onViewLog({
                      kind: "deployment",
                      id: deployment.deployment_id,
                      title: `Deployment log for ${deployment.deployment_id}`,
                    })
                  }
                >
                  View log
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function DeploysPage() {
  const { applications, loading, error, refresh, queueBuild, queueDeployment, buildingApplicationId, deployingKey } =
    useDeploys()
  const [logModal, setLogModal] = useState<LogModalState | null>(null)
  const [logContent, setLogContent] = useState("")
  const [logLoading, setLogLoading] = useState(false)
  const [logError, setLogError] = useState<string | null>(null)

  useEffect(() => {
    if (!logModal) {
      return
    }

    let cancelled = false
    setLogLoading(true)
    setLogError(null)
    setLogContent("")

    const loader =
      logModal.kind === "build" ? deploysApi.getBuildLog(logModal.id) : deploysApi.getDeploymentLog(logModal.id)

    loader
      .then(content => {
        if (!cancelled) {
          setLogContent(content)
        }
      })
      .catch(fetchError => {
        if (!cancelled) {
          setLogError(fetchError instanceof Error ? fetchError.message : "Failed to load log")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLogLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [logModal])

  if (loading && applications.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error && applications.length === 0) {
    return (
      <EmptyState
        title="Failed to load deploy control plane"
        description={error}
        action={<Button onClick={refresh}>Retry</Button>}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Deploys"
        description="Build once, then promote the same immutable artifact through staging and production."
      />

      {applications.length === 0 ? (
        <EmptyState
          title="No deploy applications"
          description="Seed an application into deploy.applications to start using the control plane."
          action={<Button onClick={refresh}>Refresh</Button>}
        />
      ) : (
        <div className="space-y-8">
          {applications.map(application => (
            <section key={application.application_id} className="rounded-card border border-border p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[16px] font-semibold text-text-primary">{application.display_name}</h2>
                    <Badge variant="accent">{application.slug}</Badge>
                  </div>
                  <p className="mt-1 text-[13px] text-text-tertiary">
                    {application.repo_owner}/{application.repo_name} · config {application.config_path}
                  </p>
                  <p className="mt-1 text-[12px] text-text-tertiary">Default branch: {application.default_branch}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {application.environments.map(environment => (
                  <EnvironmentCard key={environment.environment_id} environment={environment} />
                ))}
              </div>

              <div className="mt-6 space-y-6">
                <BuildsSection
                  application={application}
                  buildingApplicationId={buildingApplicationId}
                  queueBuild={queueBuild}
                  onViewLog={setLogModal}
                />
                <ReleasesSection
                  application={application}
                  queueDeployment={queueDeployment}
                  deployingKey={deployingKey}
                  onViewLog={setLogModal}
                />
                <DeploymentsSection application={application} onViewLog={setLogModal} />
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal
        open={logModal !== null}
        onClose={() => setLogModal(null)}
        title={logModal?.title ?? "Log"}
        className="max-w-5xl"
        footer={<Button onClick={() => setLogModal(null)}>Close</Button>}
      >
        <div
          className={cn(
            "rounded-input border border-border bg-zinc-950 text-zinc-100 p-4 min-h-[360px] max-h-[70vh] overflow-auto",
            "font-mono text-[12px] leading-5 whitespace-pre-wrap",
          )}
        >
          {logLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="md" />
            </div>
          ) : logError ? (
            <p className="text-red-300">{logError}</p>
          ) : (
            logContent || "No log output yet"
          )}
        </div>
      </Modal>
    </>
  )
}

export default DeploysPage
