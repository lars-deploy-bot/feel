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
}

#[derive(Clone, Debug, Serialize)]
pub(crate) struct HealthState {
    pub(crate) status: String,
    pub(crate) last_poll_at: Option<String>,
    pub(crate) current_build_id: Option<String>,
    pub(crate) current_deployment_id: Option<String>,
    pub(crate) last_error: Option<String>,
}

impl Default for HealthState {
    fn default() -> Self {
        Self {
            status: "starting".to_string(),
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

#[derive(Debug)]
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

#[derive(Debug)]
pub(crate) struct ReleaseRow {
    pub(crate) release_id: String,
    pub(crate) application_id: String,
    pub(crate) artifact_ref: String,
    pub(crate) artifact_digest: String,
    pub(crate) alive_toml_snapshot: String,
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

#[derive(Debug, Default, Deserialize)]
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

#[derive(Clone, Copy)]
pub(crate) enum TaskKind {
    Build,
    Deployment,
}

#[derive(Serialize)]
pub(crate) struct TaskEvent<'a> {
    pub(crate) at: String,
    pub(crate) task_kind: &'a str,
    pub(crate) task_id: &'a str,
    pub(crate) event_type: &'a str,
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
