use anyhow::{Context, Result};
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::source_contract::BuildInput;
use crate::types::{AliveConfig, ResolvedBuildSecret};

const BUILD_FINGERPRINT_VERSION: u8 = 1;

#[derive(Serialize)]
struct BuildFingerprint<'a> {
    version: u8,
    deployer_version: &'static str,
    source_adapter: &'a str,
    source_identity: &'a str,
    build_context_fingerprint: &'a str,
    policy_version: &'a str,
    config_path: &'a str,
    alive_toml_snapshot: &'a str,
    docker: BuildDockerFingerprint<'a>,
    build_secrets: Vec<BuildSecretFingerprint>,
}

#[derive(Serialize)]
struct BuildDockerFingerprint<'a> {
    context: &'a str,
    dockerfile: &'a str,
    target: &'a str,
    image_repository: &'a str,
}

#[derive(Serialize)]
struct BuildSecretFingerprint {
    id: String,
    content_sha256: String,
}

pub(crate) async fn compute_build_fingerprint(
    build_input: &BuildInput,
    config_path: &str,
    alive_toml_snapshot: &str,
    alive_config: &AliveConfig,
    build_secrets: &[ResolvedBuildSecret],
) -> Result<String> {
    let mut secret_fingerprints = Vec::with_capacity(build_secrets.len());
    for secret in build_secrets {
        let bytes = tokio::fs::read(&secret.source)
            .await
            .with_context(|| format!("failed to read build secret {}", secret.source.display()))?;
        secret_fingerprints.push(BuildSecretFingerprint {
            id: secret.id.clone(),
            content_sha256: sha256_hex(&bytes),
        });
    }
    secret_fingerprints.sort_by(|left, right| left.id.cmp(&right.id));

    let fingerprint = BuildFingerprint {
        version: BUILD_FINGERPRINT_VERSION,
        deployer_version: env!("CARGO_PKG_VERSION"),
        source_adapter: build_input.source_kind.as_str(),
        source_identity: &build_input.source_identity,
        build_context_fingerprint: &build_input.build_context_fingerprint,
        policy_version: build_input.policy_version.as_str(),
        config_path,
        alive_toml_snapshot,
        docker: BuildDockerFingerprint {
            context: &alive_config.docker.context,
            dockerfile: &alive_config.docker.dockerfile,
            target: &alive_config.docker.target,
            image_repository: &alive_config.docker.image_repository,
        },
        build_secrets: secret_fingerprints,
    };

    let raw = serde_json::to_vec(&fingerprint).context("failed to serialize build fingerprint")?;
    Ok(sha256_hex(&raw))
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}
