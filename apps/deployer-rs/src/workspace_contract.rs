use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::types::{EnvironmentRow, ReleaseRow};

const SHORT_HASH_BYTES: usize = 12;

fn short_sha256(input: &[u8]) -> String {
    let digest = Sha256::digest(input);
    let hex = format!("{:x}", digest);
    hex.chars().take(SHORT_HASH_BYTES * 2).collect()
}

fn validate_non_empty(value: impl Into<String>, label: &str) -> Result<String> {
    let value = value.into();
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("{} must not be empty", label));
    }
    Ok(trimmed.to_string())
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub(crate) struct OrganizationId(String);

impl OrganizationId {
    pub(crate) fn new(value: impl Into<String>) -> Result<Self> {
        Ok(Self(validate_non_empty(value, "organization_id")?))
    }

    pub(crate) fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub(crate) struct WorkspaceId(String);

impl WorkspaceId {
    pub(crate) fn new(value: impl Into<String>) -> Result<Self> {
        Ok(Self(validate_non_empty(value, "workspace_id")?))
    }

    pub(crate) fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub(crate) struct WorkspaceScope {
    pub(crate) organization_id: OrganizationId,
    pub(crate) workspace_id: WorkspaceId,
}

impl WorkspaceScope {
    pub(crate) fn from_environment(environment: &EnvironmentRow) -> Result<Self> {
        let organization_id = environment.org_id.clone().ok_or_else(|| {
            anyhow!(
                "environment {} is missing org_id",
                environment.environment_id
            )
        })?;
        let workspace_id = environment.domain_id.clone().ok_or_else(|| {
            anyhow!(
                "environment {} is missing domain_id",
                environment.environment_id
            )
        })?;

        Ok(Self {
            organization_id: OrganizationId::new(organization_id)?,
            workspace_id: WorkspaceId::new(workspace_id)?,
        })
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub(crate) struct SnapshotId(String);

impl SnapshotId {
    pub(crate) fn from_git_sha(git_sha: &str) -> Result<Self> {
        let git_sha = validate_non_empty(git_sha, "git_sha")?;
        Ok(Self(format!("snap_git_{}", git_sha)))
    }

    pub(crate) fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub(crate) struct PolicyVersion(String);

impl PolicyVersion {
    pub(crate) fn from_alive_toml(alive_toml: &str) -> Result<Self> {
        let alive_toml = validate_non_empty(alive_toml, "alive_toml_snapshot")?;
        Ok(Self(format!(
            "alive_toml_{}",
            short_sha256(alive_toml.as_bytes())
        )))
    }

    pub(crate) fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum RuntimeKind {
    Host,
    E2b,
    Hetzner,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub(crate) enum WorkspaceInput {
    GitRef {
        repo_owner: String,
        repo_name: String,
        git_ref: String,
        git_sha: String,
    },
    Release {
        git_sha: String,
    },
    RuntimeCapture {
        runtime: RuntimeKind,
    },
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub(crate) struct SourceSnapshot {
    pub(crate) scope: WorkspaceScope,
    pub(crate) snapshot_id: SnapshotId,
    pub(crate) policy_version: PolicyVersion,
    pub(crate) input: WorkspaceInput,
}

impl SourceSnapshot {
    pub(crate) fn from_release(
        scope: WorkspaceScope,
        release: &ReleaseRow,
        input: WorkspaceInput,
    ) -> Result<Self> {
        Ok(Self {
            scope,
            snapshot_id: SnapshotId::from_git_sha(&release.git_sha)?,
            policy_version: PolicyVersion::from_alive_toml(&release.alive_toml_snapshot)?,
            input,
        })
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub(crate) struct RuntimeTarget {
    pub(crate) runtime: RuntimeKind,
    pub(crate) server_id: String,
    pub(crate) environment: String,
    pub(crate) hostname: String,
    pub(crate) port: u16,
    pub(crate) healthcheck_path: String,
}

impl RuntimeTarget {
    pub(crate) fn for_environment(
        runtime: RuntimeKind,
        environment: &EnvironmentRow,
    ) -> Result<Self> {
        let port = u16::try_from(environment.port)
            .map_err(|error| anyhow!("invalid environment port {}: {}", environment.port, error))?;

        Ok(Self {
            runtime,
            server_id: validate_non_empty(environment.server_id.clone(), "server_id")?,
            environment: validate_non_empty(environment.name.clone(), "environment.name")?,
            hostname: validate_non_empty(environment.hostname.clone(), "environment.hostname")?,
            port,
            healthcheck_path: validate_non_empty(
                environment.healthcheck_path.clone(),
                "environment.healthcheck_path",
            )?,
        })
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub(crate) struct DeployRequest {
    pub(crate) desired_snapshot: SourceSnapshot,
    pub(crate) runtime_target: RuntimeTarget,
    pub(crate) release_id: String,
}

impl DeployRequest {
    pub(crate) fn from_release(
        scope: WorkspaceScope,
        release: &ReleaseRow,
        runtime_target: RuntimeTarget,
    ) -> Result<Self> {
        Ok(Self {
            desired_snapshot: SourceSnapshot::from_release(
                scope,
                release,
                WorkspaceInput::Release {
                    git_sha: release.git_sha.clone(),
                },
            )?,
            runtime_target,
            release_id: validate_non_empty(release.release_id.clone(), "release_id")?,
        })
    }
}

#[allow(dead_code)]
#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
pub(crate) struct WorkspaceDiff {
    pub(crate) added_paths: usize,
    pub(crate) changed_paths: usize,
    pub(crate) removed_paths: usize,
}

#[allow(dead_code)]
pub(crate) trait WorkspaceAdapter {
    fn runtime_kind(&self) -> RuntimeKind;
    fn ingest(&self, input: &WorkspaceInput) -> Result<SourceSnapshot>;
    fn materialize(&self, snapshot: &SourceSnapshot, target: &RuntimeTarget) -> Result<()>;
    fn capture(&self, scope: &WorkspaceScope, target: &RuntimeTarget) -> Result<SourceSnapshot>;
    fn diff(&self, current: &SourceSnapshot, desired: &SourceSnapshot) -> Result<WorkspaceDiff>;
}
