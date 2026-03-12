use std::path::PathBuf;

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

use crate::types::SourceAdapter;
use crate::workspace_contract::PolicyVersion;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum SourceKind {
    Git,
    LocalFs,
    E2b,
}

impl SourceKind {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Git => "git",
            Self::LocalFs => "local_fs",
            Self::E2b => "e2b",
        }
    }
}

impl From<SourceAdapter> for SourceKind {
    fn from(value: SourceAdapter) -> Self {
        match value {
            SourceAdapter::Git => Self::Git,
            SourceAdapter::LocalFs => Self::LocalFs,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub(crate) struct BuildInput {
    pub(crate) source_kind: SourceKind,
    pub(crate) source_root: PathBuf,
    pub(crate) build_context: PathBuf,
    pub(crate) snapshot_id: String,
    pub(crate) source_identity: String,
    pub(crate) build_context_fingerprint: String,
    pub(crate) policy_version: PolicyVersion,
    pub(crate) release_git_sha: String,
    pub(crate) release_commit_message: String,
}

impl BuildInput {
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn new(
        source_kind: SourceKind,
        source_root: PathBuf,
        build_context: PathBuf,
        snapshot_id: String,
        source_identity: String,
        build_context_fingerprint: String,
        policy_version: PolicyVersion,
        release_git_sha: String,
        release_commit_message: String,
    ) -> Result<Self> {
        if source_identity.trim().is_empty() {
            return Err(anyhow!("source_identity must not be empty"));
        }
        if snapshot_id.trim().is_empty() {
            return Err(anyhow!("snapshot_id must not be empty"));
        }
        if build_context_fingerprint.trim().is_empty() {
            return Err(anyhow!("build_context_fingerprint must not be empty"));
        }
        if release_git_sha.trim().is_empty() {
            return Err(anyhow!("release_git_sha must not be empty"));
        }
        if release_commit_message.trim().is_empty() {
            return Err(anyhow!("release_commit_message must not be empty"));
        }

        Ok(Self {
            source_kind,
            source_root,
            build_context,
            snapshot_id,
            source_identity,
            build_context_fingerprint,
            policy_version,
            release_git_sha,
            release_commit_message,
        })
    }

    pub(crate) fn short_identity(&self) -> String {
        self.build_context_fingerprint.chars().take(12).collect()
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub(crate) struct BuildArtifact {
    pub(crate) image_ref: String,
    pub(crate) local_image_id: Option<String>,
    pub(crate) artifact_digest: Option<String>,
}

impl BuildArtifact {
    pub(crate) fn local_image(image_repository: &str, build_input: &BuildInput) -> Result<Self> {
        if image_repository.trim().is_empty() {
            return Err(anyhow!("image_repository must not be empty"));
        }

        Ok(Self {
            image_ref: format!("{}:{}", image_repository, build_input.short_identity()),
            local_image_id: None,
            artifact_digest: None,
        })
    }

    pub(crate) fn with_local_image_id(mut self, local_image_id: String) -> Result<Self> {
        if local_image_id.trim().is_empty() {
            return Err(anyhow!("local_image_id must not be empty"));
        }
        self.local_image_id = Some(local_image_id);
        Ok(self)
    }

    pub(crate) fn with_artifact_digest(mut self, artifact_digest: String) -> Result<Self> {
        if artifact_digest.trim().is_empty() {
            return Err(anyhow!("artifact_digest must not be empty"));
        }
        self.artifact_digest = Some(artifact_digest);
        Ok(self)
    }
}
