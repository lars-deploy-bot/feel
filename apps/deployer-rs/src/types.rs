use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::RwLock;

#[derive(Clone)]
pub(crate) struct ServiceContext {
    pub(crate) env: ServiceEnv,
    pub(crate) repo_root: PathBuf,
    pub(crate) data_dir: PathBuf,
    pub(crate) hostname: String,
}

#[derive(Clone)]
pub(crate) struct AppState {
    pub(crate) health: Arc<RwLock<HealthState>>,
    pub(crate) data_dir: PathBuf,
}

#[derive(Clone, Debug, Serialize)]
pub(crate) struct HealthState {
    pub(crate) status: WorkerStatus,
    pub(crate) last_poll_at: Option<String>,
    pub(crate) current_build_id: Option<String>,
    pub(crate) current_deployment_id: Option<String>,
    pub(crate) last_error: Option<String>,
}

impl Default for HealthState {
    fn default() -> Self {
        Self {
            status: WorkerStatus::Starting,
            last_poll_at: None,
            current_build_id: None,
            current_deployment_id: None,
            last_error: None,
        }
    }
}

#[derive(Clone, Debug)]
pub(crate) struct ServiceEnv {
    pub(crate) database_url: String,
    pub(crate) server_config_path: PathBuf,
    pub(crate) server_id: String,
}

#[derive(Debug, Deserialize, Clone)]
pub(crate) struct AliveConfig {
    pub(crate) schema: u32,
    pub(crate) project: ProjectConfig,
    pub(crate) docker: DockerConfig,
    pub(crate) runtime: RuntimeConfig,
    #[serde(default)]
    pub(crate) build_secrets: Vec<BuildSecret>,
    #[serde(default)]
    pub(crate) policies: PolicyMap,
}

#[derive(Debug, Deserialize, Clone)]
pub(crate) struct ProjectConfig {
    pub(crate) slug: String,
    pub(crate) display_name: String,
    pub(crate) repo_owner: String,
    pub(crate) repo_name: String,
    pub(crate) default_branch: String,
}

#[derive(Debug, Deserialize, Clone)]
pub(crate) struct DockerConfig {
    pub(crate) context: String,
    pub(crate) dockerfile: String,
    pub(crate) target: String,
    pub(crate) image_repository: String,
}

#[derive(Debug, Deserialize, Clone)]
pub(crate) struct RuntimeConfig {
    pub(crate) env_file: String,
    pub(crate) container_port: u16,
    pub(crate) healthcheck_path: String,
    #[serde(default)]
    pub(crate) network_mode: Option<String>,
    #[serde(default)]
    pub(crate) bind_mounts: Vec<BindMount>,
}

#[derive(Debug, Deserialize, Clone)]
pub(crate) struct BuildSecret {
    pub(crate) id: String,
    pub(crate) path: Option<String>,
    pub(crate) env: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub(crate) struct BindMount {
    pub(crate) source: Option<String>,
    pub(crate) source_env: Option<String>,
    pub(crate) target: String,
    #[serde(default)]
    pub(crate) read_only: bool,
}

#[derive(Debug, Deserialize, Clone, Default)]
pub(crate) struct PolicyMap {
    pub(crate) staging: Option<EnvironmentPolicy>,
    pub(crate) production: Option<EnvironmentPolicy>,
}

#[derive(Debug, Deserialize, Clone, Default)]
pub(crate) struct EnvironmentPolicy {
    pub(crate) allow_email: bool,
    #[serde(default)]
    pub(crate) blocked_env_keys: Vec<String>,
    #[serde(default)]
    pub(crate) forced_env: BTreeMap<String, String>,
}

#[derive(Debug)]
pub(crate) struct ClaimedBuild {
    pub(crate) build_id: String,
    pub(crate) application_id: String,
    pub(crate) git_ref: String,
}

#[derive(Debug)]
pub(crate) struct ClaimedDeployment {
    pub(crate) deployment_id: String,
    pub(crate) environment_id: String,
    pub(crate) release_id: String,
}

#[derive(Debug)]
pub(crate) struct ApplicationRow {
    pub(crate) slug: String,
    pub(crate) display_name: String,
    pub(crate) repo_owner: String,
    pub(crate) repo_name: String,
    pub(crate) default_branch: String,
    pub(crate) config_path: String,
}

#[derive(Clone, Debug)]
pub(crate) struct EnvironmentRow {
    pub(crate) environment_id: String,
    pub(crate) application_id: String,
    pub(crate) server_id: String,
    pub(crate) name: String,
    pub(crate) hostname: String,
    pub(crate) port: i32,
    pub(crate) healthcheck_path: String,
    pub(crate) allow_email: bool,
    pub(crate) runtime_overrides: EnvironmentRuntimeOverrides,
}

#[derive(Clone, Debug)]
pub(crate) struct ReleaseRow {
    pub(crate) release_id: String,
    pub(crate) application_id: String,
    pub(crate) git_sha: String,
    pub(crate) commit_message: String,
    pub(crate) artifact_ref: String,
    pub(crate) artifact_digest: String,
    pub(crate) alive_toml_snapshot: String,
    pub(crate) build_fingerprint: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct GitHubCommitPayload {
    pub(crate) sha: String,
    pub(crate) commit: GitHubCommitDetails,
}

#[derive(Debug, Deserialize)]
pub(crate) struct GitHubCommitDetails {
    pub(crate) message: String,
}

#[derive(Clone, Debug, Default, Deserialize)]
pub(crate) struct EnvironmentRuntimeOverrides {
    pub(crate) env_file_path: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ServerConfigIdentity {
    #[serde(rename = "serverId")]
    pub(crate) server_id: String,
}

#[derive(Clone, Copy)]
pub(crate) enum LeaseTarget {
    Build,
    Deployment,
}

pub(crate) struct RollbackContainer {
    pub(crate) original_name: String,
    pub(crate) rollback_name: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum TaskKind {
    Build,
    Deployment,
}

impl TaskKind {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Build => "build",
            Self::Deployment => "deployment",
        }
    }

    pub(crate) fn from_route_segment(segment: &str) -> Option<Self> {
        match segment {
            "build" | "builds" => Some(Self::Build),
            "deployment" | "deployments" => Some(Self::Deployment),
            _ => None,
        }
    }

    pub(crate) fn fallback_failure_kind(self) -> FailureKind {
        match self {
            Self::Build => FailureKind::BuildFailed,
            Self::Deployment => FailureKind::DeploymentFailed,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum WorkerStatus {
    Starting,
    Idle,
    Building,
    Deploying,
    Error,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum TaskStatus {
    Running,
    Succeeded,
    Failed,
    Legacy,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum TaskStage {
    ResolveCommit,
    PrepareSource,
    ReuseRelease,
    BuildImage,
    PublishArtifact,
    RecordRelease,
    PrepareRuntime,
    PullArtifact,
    ReserveRollback,
    StartContainer,
    LocalHealth,
    Stability,
    PublicHealth,
    Rollback,
    Task,
}

impl TaskStage {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::ResolveCommit => "resolve_commit",
            Self::PrepareSource => "prepare_source",
            Self::ReuseRelease => "reuse_release",
            Self::BuildImage => "build_image",
            Self::PublishArtifact => "publish_artifact",
            Self::RecordRelease => "record_release",
            Self::PrepareRuntime => "prepare_runtime",
            Self::PullArtifact => "pull_artifact",
            Self::ReserveRollback => "reserve_rollback",
            Self::StartContainer => "start_container",
            Self::LocalHealth => "local_health",
            Self::Stability => "stability",
            Self::PublicHealth => "public_health",
            Self::Rollback => "rollback",
            Self::Task => "task",
        }
    }

    pub(crate) fn slug(self) -> &'static str {
        match self {
            Self::ResolveCommit => "resolve-commit",
            Self::PrepareSource => "prepare-source",
            Self::ReuseRelease => "reuse-release",
            Self::BuildImage => "build-image",
            Self::PublishArtifact => "publish-artifact",
            Self::RecordRelease => "record-release",
            Self::PrepareRuntime => "prepare-runtime",
            Self::PullArtifact => "pull-artifact",
            Self::ReserveRollback => "reserve-rollback",
            Self::StartContainer => "start-container",
            Self::LocalHealth => "local-health",
            Self::Stability => "stability",
            Self::PublicHealth => "public-health",
            Self::Rollback => "rollback",
            Self::Task => "task",
        }
    }

    pub(crate) fn failure_kind(self) -> FailureKind {
        match self {
            Self::ResolveCommit => FailureKind::SourceResolutionFailed,
            Self::PrepareSource => FailureKind::SourceSnapshotFailed,
            Self::BuildImage => FailureKind::BuildImageFailed,
            Self::PublishArtifact => FailureKind::ArtifactPublishFailed,
            Self::RecordRelease => FailureKind::ReleaseRecordFailed,
            Self::PrepareRuntime => FailureKind::RuntimeEnvFailed,
            Self::PullArtifact => FailureKind::ArtifactPullFailed,
            Self::ReserveRollback => FailureKind::RollbackReserveFailed,
            Self::StartContainer => FailureKind::RuntimeStartFailed,
            Self::LocalHealth => FailureKind::LocalHealthFailed,
            Self::Stability => FailureKind::StabilityFailed,
            Self::PublicHealth => FailureKind::PublicHealthFailed,
            Self::Rollback => FailureKind::RollbackFailed,
            Self::ReuseRelease | Self::Task => FailureKind::TaskFailed,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum FailureKind {
    SourceResolutionFailed,
    SourceSnapshotFailed,
    BuildImageFailed,
    ArtifactPublishFailed,
    ReleaseRecordFailed,
    RuntimeEnvFailed,
    ArtifactPullFailed,
    RollbackReserveFailed,
    RuntimeStartFailed,
    LocalHealthFailed,
    StabilityFailed,
    PublicHealthFailed,
    RollbackFailed,
    TaskFailed,
    BuildFailed,
    DeploymentFailed,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum TaskEventType {
    Started,
    Failed,
    Succeeded,
    CommitResolved,
    ReleaseReused,
    ArtifactPushed,
    RuntimeEnvPrepared,
    ArtifactPulled,
    RollbackReserved,
    ContainerStarted,
    LocalHealthPassed,
    PublicHealthPassed,
    RollbackRestored,
    ReconciledMissingContainer,
    StageStarted,
    StageSucceeded,
    StageFailed,
}

#[derive(Serialize)]
pub(crate) struct TaskEvent<'a> {
    pub(crate) at: String,
    pub(crate) task_kind: TaskKind,
    pub(crate) task_id: &'a str,
    pub(crate) event_type: TaskEventType,
    pub(crate) details: Value,
}

#[derive(Debug, Serialize)]
pub(crate) struct HealthResponse {
    pub(crate) ok: bool,
    pub(crate) worker: HealthState,
}

#[derive(Clone, Copy)]
pub(crate) enum RuntimeNetworkMode {
    Bridge,
    Host,
}

#[derive(Debug)]
pub(crate) struct ResolvedBuildSecret {
    pub(crate) id: String,
    pub(crate) source: PathBuf,
}
