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
    pub(crate) poke: Arc<tokio::sync::Notify>,
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
    pub(crate) alive_root: PathBuf,
    pub(crate) sites_root: Option<PathBuf>,
    pub(crate) templates_root: Option<PathBuf>,
    pub(crate) images_storage: Option<PathBuf>,
}

#[derive(Debug, Deserialize, Clone)]
pub(crate) struct AliveConfig {
    pub(crate) schema: u32,
    pub(crate) project: ProjectConfig,
    #[serde(default)]
    pub(crate) source: SourceConfig,
    #[serde(default)]
    pub(crate) docker: Option<DockerConfig>,
    #[serde(default)]
    pub(crate) systemd: Option<SystemdConfig>,
    pub(crate) runtime: RuntimeConfig,
    #[serde(default)]
    pub(crate) build: Option<BuildConfig>,
    #[serde(default)]
    pub(crate) build_secrets: Vec<BuildSecret>,
    #[serde(default)]
    pub(crate) policies: PolicyMap,
}

#[derive(Debug, Deserialize, Clone)]
pub(crate) struct SourceConfig {
    pub(crate) adapter: SourceAdapter,
    #[serde(default = "default_source_path")]
    pub(crate) path: String,
}

impl Default for SourceConfig {
    fn default() -> Self {
        Self {
            adapter: SourceAdapter::Git,
            path: default_source_path(),
        }
    }
}

fn default_source_path() -> String {
    ".".to_string()
}

#[derive(Debug, Deserialize, Clone, Copy, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum SourceAdapter {
    Git,
    LocalFs,
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
    #[serde(default)]
    pub(crate) kind: RuntimeKindConfig,
    pub(crate) env_file: String,
    pub(crate) container_port: u16,
    pub(crate) healthcheck_path: String,
    #[serde(default)]
    pub(crate) network_mode: Option<RuntimeNetworkMode>,
    #[serde(default)]
    pub(crate) privileged: bool,
    #[serde(default)]
    pub(crate) pid_mode: Option<String>,
    #[serde(default)]
    pub(crate) bind_mounts: Vec<BindMount>,
}

#[derive(Debug, Default, Deserialize, Clone, Copy, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum RuntimeKindConfig {
    #[default]
    Host,
    E2b,
    Hetzner,
    Systemd,
}

#[derive(Debug, Deserialize, Clone)]
pub(crate) struct SystemdConfig {
    /// Template for the systemd unit name, e.g. "alive-{environment}.service"
    pub(crate) unit_template: String,
    /// Template for the release directory, e.g. ".builds/{environment}"
    #[allow(dead_code)]
    pub(crate) release_dir_template: String,
    /// Path within the build output that becomes the runtime root (relative to repo root)
    pub(crate) release_root: String,
}

#[derive(Debug, Deserialize, Clone)]
pub(crate) struct BuildConfig {
    pub(crate) setup_command: Option<String>,
    pub(crate) command: String,
    /// Paths relative to repo root that constitute the build output
    pub(crate) outputs: Vec<String>,
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
    pub(crate) source_server_path: Option<BindMountServerPath>,
    pub(crate) target: Option<String>,
    pub(crate) target_server_path: Option<BindMountServerPath>,
    #[serde(default)]
    pub(crate) read_only: bool,
}

#[derive(Debug, Deserialize, Clone, Copy, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum BindMountServerPath {
    AliveRoot,
    SitesRoot,
    TemplatesRoot,
    ImagesStorage,
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
    pub(crate) git_sha: String,
    pub(crate) commit_message: String,
    pub(crate) lease_token: String,
}

#[derive(Debug)]
pub(crate) struct ClaimedDeployment {
    pub(crate) deployment_id: String,
    pub(crate) environment_id: String,
    pub(crate) release_id: String,
    pub(crate) lease_token: String,
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
    pub(crate) domain_id: Option<String>,
    pub(crate) org_id: Option<String>,
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
    pub(crate) paths: ServerConfigPaths,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ServerConfigPaths {
    #[serde(rename = "aliveRoot")]
    pub(crate) alive_root: String,
    #[serde(rename = "sitesRoot")]
    pub(crate) sites_root: Option<String>,
    #[serde(rename = "templatesRoot")]
    pub(crate) templates_root: Option<String>,
    #[serde(rename = "imagesStorage")]
    pub(crate) images_storage: Option<String>,
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

pub(crate) struct RollbackSymlink {
    pub(crate) symlink_path: PathBuf,
    pub(crate) previous_target: Option<PathBuf>,
}

// =============================================================================
// Adapter types — shared interface between Docker and Systemd runtimes
// =============================================================================

/// Opaque reference to a build artifact produced by a runtime adapter.
pub(crate) enum ArtifactRef {
    DockerImage {
        image_ref: String,
        image_digest: String,
    },
    Directory {
        artifact_ref: String,
        content_digest: String,
    },
}

impl ArtifactRef {
    pub(crate) fn artifact_ref_str(&self) -> &str {
        match self {
            Self::DockerImage { image_ref, .. } => image_ref,
            Self::Directory { artifact_ref, .. } => artifact_ref,
        }
    }

    pub(crate) fn artifact_digest_str(&self) -> &str {
        match self {
            Self::DockerImage { image_digest, .. } => image_digest,
            Self::Directory { content_digest, .. } => content_digest,
        }
    }
}

/// Saved state for rollback. Each adapter produces its own variant.
pub(crate) enum RollbackState {
    Container(RollbackContainer),
    #[allow(dead_code)]
    Symlink(RollbackSymlink),
    None,
}

/// A human-readable label for the runtime instance (for logging/reconciliation).
pub(crate) struct RuntimeLabel(pub(crate) String);

impl std::fmt::Display for RuntimeLabel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

/// Parameters for the build phase, passed to the adapter.
pub(crate) struct BuildParams<'a> {
    pub(crate) source_root: &'a std::path::Path,
    pub(crate) alive_config: &'a AliveConfig,
    pub(crate) build_input: &'a crate::source_contract::BuildInput,
    pub(crate) build_secrets: &'a [ResolvedBuildSecret],
    pub(crate) build_id: &'a str,
    pub(crate) git_ref: &'a str,
    pub(crate) data_dir: &'a std::path::Path,
}

/// Parameters for the deployment phase, passed to the adapter.
pub(crate) struct DeployParams<'a> {
    pub(crate) config: &'a AliveConfig,
    pub(crate) environment: &'a EnvironmentRow,
    pub(crate) release: &'a ReleaseRow,
    pub(crate) deployment_id: &'a str,
    pub(crate) context: &'a ServiceContext,
    pub(crate) sanitized_env_file: &'a std::path::Path,
    pub(crate) host_port: u16,
    pub(crate) network_mode: RuntimeNetworkMode,
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
    DeployRequestPrepared,
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

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum RuntimeNetworkMode {
    Bridge,
    Host,
}

#[derive(Debug)]
pub(crate) struct ResolvedBuildSecret {
    pub(crate) id: String,
    pub(crate) source: PathBuf,
}
