use anyhow::Error as AnyhowError;
use thiserror::Error;

#[derive(Debug, Error)]
pub(crate) enum TaskExecutionError {
    #[error("source snapshot failed")]
    SourceSnapshot {
        #[source]
        source: AnyhowError,
    },
    #[error("build validation failed")]
    BuildValidation {
        #[source]
        source: AnyhowError,
    },
    #[error("build fingerprint failed")]
    BuildFingerprint {
        #[source]
        source: AnyhowError,
    },
    #[error("artifact build failed")]
    BuildImage {
        #[source]
        source: AnyhowError,
    },
    #[error("artifact publish failed")]
    ArtifactPublish {
        #[source]
        source: AnyhowError,
    },
    #[error("release record failed")]
    ReleaseRecord {
        #[source]
        source: AnyhowError,
    },
    #[error("deployment validation failed")]
    DeploymentValidation {
        #[source]
        source: AnyhowError,
    },
    #[error("runtime preparation failed")]
    RuntimePreparation {
        #[source]
        source: AnyhowError,
    },
    #[error("artifact pull failed")]
    ArtifactPull {
        #[source]
        source: AnyhowError,
    },
    #[error("rollback preparation failed")]
    RollbackPreparation {
        #[source]
        source: AnyhowError,
    },
    #[error("runtime start failed")]
    RuntimeStart {
        #[source]
        source: AnyhowError,
    },
    #[error("local health check failed")]
    LocalHealth {
        #[source]
        source: AnyhowError,
    },
    #[error("stability check failed")]
    Stability {
        #[source]
        source: AnyhowError,
    },
    #[error("public health check failed")]
    PublicHealth {
        #[source]
        source: AnyhowError,
    },
    #[error("rollback failed")]
    Rollback {
        #[source]
        source: AnyhowError,
    },
    #[error("database transition failed")]
    DbTransition {
        #[source]
        source: AnyhowError,
    },
}

impl TaskExecutionError {
    pub(crate) fn source_snapshot(source: impl Into<AnyhowError>) -> Self {
        Self::SourceSnapshot {
            source: source.into(),
        }
    }

    pub(crate) fn build_validation(source: impl Into<AnyhowError>) -> Self {
        Self::BuildValidation {
            source: source.into(),
        }
    }

    pub(crate) fn build_fingerprint(source: impl Into<AnyhowError>) -> Self {
        Self::BuildFingerprint {
            source: source.into(),
        }
    }

    pub(crate) fn build_image(source: impl Into<AnyhowError>) -> Self {
        Self::BuildImage {
            source: source.into(),
        }
    }

    pub(crate) fn artifact_publish(source: impl Into<AnyhowError>) -> Self {
        Self::ArtifactPublish {
            source: source.into(),
        }
    }

    pub(crate) fn release_record(source: impl Into<AnyhowError>) -> Self {
        Self::ReleaseRecord {
            source: source.into(),
        }
    }

    pub(crate) fn deployment_validation(source: impl Into<AnyhowError>) -> Self {
        Self::DeploymentValidation {
            source: source.into(),
        }
    }

    pub(crate) fn runtime_preparation(source: impl Into<AnyhowError>) -> Self {
        Self::RuntimePreparation {
            source: source.into(),
        }
    }

    pub(crate) fn artifact_pull(source: impl Into<AnyhowError>) -> Self {
        Self::ArtifactPull {
            source: source.into(),
        }
    }

    pub(crate) fn rollback_preparation(source: impl Into<AnyhowError>) -> Self {
        Self::RollbackPreparation {
            source: source.into(),
        }
    }

    pub(crate) fn runtime_start(source: impl Into<AnyhowError>) -> Self {
        Self::RuntimeStart {
            source: source.into(),
        }
    }

    pub(crate) fn local_health(source: impl Into<AnyhowError>) -> Self {
        Self::LocalHealth {
            source: source.into(),
        }
    }

    pub(crate) fn stability(source: impl Into<AnyhowError>) -> Self {
        Self::Stability {
            source: source.into(),
        }
    }

    pub(crate) fn public_health(source: impl Into<AnyhowError>) -> Self {
        Self::PublicHealth {
            source: source.into(),
        }
    }

    pub(crate) fn rollback(source: impl Into<AnyhowError>) -> Self {
        Self::Rollback {
            source: source.into(),
        }
    }

    pub(crate) fn db_transition(source: impl Into<AnyhowError>) -> Self {
        Self::DbTransition {
            source: source.into(),
        }
    }

    pub(crate) fn display_full(&self) -> String {
        use std::error::Error;
        let mut msg = self.to_string();
        if let Some(source) = self.source() {
            msg.push_str(": ");
            msg.push_str(&format!("{:#}", source));
        }
        msg
    }
}
