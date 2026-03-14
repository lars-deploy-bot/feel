use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};
use serde_json::json;
use sha2::{Digest, Sha256};
use tokio::fs as tokio_fs;
use tokio::process::Command;
use tokio_postgres::Client;

use super::error::TaskExecutionError;
use super::with_lease_heartbeat;
use crate::config::{parse_alive_toml, resolve_build_secrets, validate_application_matches_config};
use crate::constants::BUILD_TIMEOUT;
use crate::db::{
    fetch_application, find_reusable_release, mark_build_failed, mark_build_succeeded,
    record_release,
};
use crate::docker::{image_exists_locally, resolve_local_artifact_digest};
use crate::fingerprint::compute_build_fingerprint;
use crate::github::{cleanup_source_snapshot, export_github_snapshot, resolve_github_commit};
use crate::logging::{run_logged_command_with_timeout, TaskPipeline};
use crate::source_contract::{BuildArtifact, BuildInput, SourceKind};
use crate::types::{
    AliveConfig, ClaimedBuild, LeaseTarget, ServiceContext, SourceAdapter, TaskEventType, TaskStage,
};
use crate::workspace_contract::PolicyVersion;

fn assert_path_contained(child: &Path, parent: &Path, label: &str) -> Result<()> {
    let canonical_parent = parent
        .canonicalize()
        .with_context(|| format!("failed to canonicalize parent {}", parent.display()))?;
    let canonical_child = child
        .canonicalize()
        .with_context(|| format!("failed to canonicalize {} {}", label, child.display()))?;
    if !canonical_child.starts_with(&canonical_parent) {
        return Err(anyhow!(
            "{} escapes source directory: {} is outside {}",
            label,
            canonical_child.display(),
            canonical_parent.display()
        ));
    }
    Ok(())
}

pub(crate) struct PreparedBuildSource {
    pub(crate) build_input: BuildInput,
    pub(crate) alive_config: AliveConfig,
    pub(crate) alive_toml_snapshot: String,
}

fn runtime_build_metadata(
    prepared_source: &PreparedBuildSource,
    build: &ClaimedBuild,
) -> [(&'static str, String); 3] {
    [
        (
            "ALIVE_BUILD_COMMIT",
            prepared_source.build_input.release_git_sha.clone(),
        ),
        ("ALIVE_BUILD_BRANCH", build.git_ref.clone()),
        ("ALIVE_BUILD_TIME", chrono::Utc::now().to_rfc3339()),
    ]
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

async fn load_local_alive_config(
    context: &ServiceContext,
    application: &crate::types::ApplicationRow,
) -> Result<Option<(AliveConfig, String)>> {
    let config_path = context.repo_root.join(&application.config_path);
    if !tokio_fs::try_exists(&config_path)
        .await
        .with_context(|| format!("failed to stat {}", config_path.display()))?
    {
        return Ok(None);
    }

    let alive_toml_snapshot = tokio_fs::read_to_string(&config_path)
        .await
        .with_context(|| format!("failed to read {}", config_path.display()))?;
    let alive_config = parse_alive_toml(&alive_toml_snapshot)?;
    validate_application_matches_config(application, &alive_config)?;
    Ok(Some((alive_config, alive_toml_snapshot)))
}

pub(crate) async fn compute_local_source_identity(
    source_root: &Path,
    context_relative: &str,
) -> Result<String> {
    let build_context = source_root.join(context_relative);
    assert_path_contained(&build_context, source_root, "docker context")?;

    let dockerignore_path = build_context.join(".dockerignore");
    let mut command = Command::new("tar");
    command
        .current_dir(&build_context)
        .arg("--sort=name")
        .arg("--mtime=UTC 1970-01-01")
        .arg("--owner=0")
        .arg("--group=0")
        .arg("--numeric-owner")
        .arg("--exclude-vcs");

    if tokio_fs::try_exists(&dockerignore_path)
        .await
        .with_context(|| format!("failed to stat {}", dockerignore_path.display()))?
    {
        command.arg("--exclude-from").arg(&dockerignore_path);
    }

    let output = command
        .arg("-cf")
        .arg("-")
        .arg(".")
        .output()
        .await
        .with_context(|| {
            format!(
                "failed to archive docker context {}",
                build_context.display()
            )
        })?;

    if !output.status.success() {
        return Err(anyhow!(
            "failed to archive docker context {}: {}",
            build_context.display(),
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    Ok(sha256_hex(&output.stdout))
}

pub(crate) fn resolve_local_source_root(
    repo_root: &Path,
    configured_path: &str,
) -> Result<PathBuf> {
    if configured_path.trim().is_empty() {
        return Err(anyhow!(
            "source.path must not be empty for local_fs sources"
        ));
    }

    let candidate = repo_root.join(configured_path);
    assert_path_contained(&candidate, repo_root, "source.path")?;
    Ok(candidate)
}

fn resolve_release_git_metadata(build: &ClaimedBuild) -> Result<(String, String)> {
    if build.git_sha.trim().is_empty() {
        return Err(anyhow!(
            "build {} is missing git_sha for release metadata",
            build.build_id
        ));
    }
    if build.commit_message.trim().is_empty() {
        return Err(anyhow!(
            "build {} is missing commit_message for release metadata",
            build.build_id
        ));
    }
    Ok((build.git_sha.clone(), build.commit_message.clone()))
}

pub(crate) async fn prepare_build_source(
    application: &crate::types::ApplicationRow,
    context: &ServiceContext,
    build: &ClaimedBuild,
    temp_source_dir: &Path,
    temp_archive_path: &Path,
    log_path: &Path,
) -> Result<PreparedBuildSource> {
    if let Some((alive_config, alive_toml_snapshot)) =
        load_local_alive_config(context, application).await?
    {
        if alive_config.source.adapter == SourceAdapter::LocalFs {
            let (release_git_sha, release_commit_message) = resolve_release_git_metadata(build)?;
            let source_dir =
                resolve_local_source_root(&context.repo_root, &alive_config.source.path)?;
            let build_context_fingerprint =
                compute_local_source_identity(&source_dir, &alive_config.docker.context).await?;
            return Ok(PreparedBuildSource {
                build_input: BuildInput::new(
                    SourceKind::LocalFs,
                    source_dir.clone(),
                    source_dir.join(&alive_config.docker.context),
                    format!("snap_local_fs_{}", build_context_fingerprint),
                    build_context_fingerprint.clone(),
                    build_context_fingerprint,
                    PolicyVersion::from_alive_toml(&alive_toml_snapshot)?,
                    release_git_sha,
                    release_commit_message,
                )?,
                alive_config,
                alive_toml_snapshot,
            });
        }
    }

    let resolved_commit = resolve_github_commit(application, &build.git_ref, log_path).await?;
    export_github_snapshot(
        application,
        temp_source_dir,
        temp_archive_path,
        &resolved_commit.sha,
        log_path,
    )
    .await?;

    let config_path = temp_source_dir.join(&application.config_path);
    assert_path_contained(&config_path, temp_source_dir, "config_path")?;
    let config_metadata = tokio_fs::metadata(&config_path).await;
    if !matches!(config_metadata, Ok(metadata) if metadata.is_file()) {
        return Err(anyhow!(
            "git ref {} does not contain required config {}",
            resolved_commit.sha,
            application.config_path
        ));
    }

    let alive_toml_snapshot = tokio_fs::read_to_string(&config_path)
        .await
        .with_context(|| format!("failed to read {}", config_path.display()))?;
    let alive_config = parse_alive_toml(&alive_toml_snapshot)?;
    validate_application_matches_config(application, &alive_config)?;
    let build_context_fingerprint =
        compute_local_source_identity(temp_source_dir, &alive_config.docker.context).await?;

    Ok(PreparedBuildSource {
        build_input: BuildInput::new(
            SourceKind::Git,
            temp_source_dir.to_path_buf(),
            temp_source_dir.join(&alive_config.docker.context),
            format!("snap_git_{}", resolved_commit.sha),
            resolved_commit.sha.clone(),
            build_context_fingerprint,
            PolicyVersion::from_alive_toml(&alive_toml_snapshot)?,
            resolved_commit.sha,
            resolved_commit.commit.message,
        )?,
        alive_config,
        alive_toml_snapshot,
    })
}

pub(super) async fn process_build(
    client: &Client,
    context: &ServiceContext,
    build: &ClaimedBuild,
) -> Result<()> {
    let pipeline = TaskPipeline::for_build(&context.data_dir, &build.build_id);
    let log_path = pipeline.summary_path().to_path_buf();
    pipeline
        .prepare(&format!("build {} started", build.build_id))
        .await?;
    pipeline
        .emit(
            TaskEventType::Started,
            json!({ "application_id": build.application_id, "git_ref": build.git_ref }),
        )
        .await?;

    let application = fetch_application(client, &build.application_id).await?;
    let temp_source_dir = context.data_dir.join("sources").join(&build.build_id);
    let temp_archive_path = context
        .data_dir
        .join("archives")
        .join(format!("{}.tar.gz", build.build_id));

    let build_result = with_lease_heartbeat(
        client,
        LeaseTarget::Build,
        &build.build_id,
        &build.lease_token,
        async {
        let resolve_stage = pipeline
            .start_stage(1, TaskStage::ResolveCommit, "resolving build source")
            .await?;
        let prepared_source = match prepare_build_source(
            &application,
            context,
            build,
            &temp_source_dir,
            &temp_archive_path,
            resolve_stage.debug_path(),
        )
        .await
        {
            Ok(prepared) => {
                pipeline
                    .emit(
                        TaskEventType::CommitResolved,
                        json!({
                            "git_sha": &prepared.build_input.release_git_sha,
                            "repo_owner": &application.repo_owner,
                            "repo_name": &application.repo_name,
                            "source_kind": prepared.build_input.source_kind.as_str(),
                            "source_identity": &prepared.build_input.source_identity,
                            "build_context_fingerprint": &prepared.build_input.build_context_fingerprint,
                            "policy_version": prepared.build_input.policy_version.as_str(),
                            "debug_log_path": resolve_stage.debug_path().display().to_string(),
                        }),
                    )
                    .await?;
                resolve_stage
                    .finish_ok(&format!(
                        "prepared {} source {}",
                        prepared.build_input.source_kind.as_str(),
                        prepared.build_input.source_identity
                    ))
                    .await?;
                prepared
            }
            Err(error) => {
                let typed_error = TaskExecutionError::source_snapshot(error);
                resolve_stage
                    .finish_error(&typed_error.display_full())
                    .await?;
                return Err(typed_error.into());
            }
        };
        let prepare_source_stage = pipeline
            .start_stage(
                2,
                TaskStage::PrepareSource,
                "validating build source and config",
            )
            .await?;
        pipeline
            .append_summary(&format!(
                "building {} from {}/{} via {} ({})\n",
                application.display_name,
                application.repo_owner,
                application.repo_name,
                prepared_source.build_input.source_kind.as_str(),
                prepared_source.build_input.source_identity
            ))
            .await?;
        prepare_source_stage
            .finish_ok(&format!(
                "validated {}",
                prepared_source.build_input.source_root.display()
            ))
            .await?;

        let build_secrets = resolve_build_secrets(
            &prepared_source.build_input.source_root,
            &prepared_source.alive_config,
            &context.env,
        )
        .map_err(TaskExecutionError::build_validation)?;
        let build_fingerprint = compute_build_fingerprint(
            &prepared_source.build_input,
            &application.config_path,
            &prepared_source.alive_toml_snapshot,
            &prepared_source.alive_config,
            &build_secrets,
        )
        .await
        .map_err(TaskExecutionError::build_fingerprint)?;

        let reuse_release_stage = pipeline
            .start_stage(3, TaskStage::ReuseRelease, "checking for reusable release")
            .await?;
        let mut reuse_missed_due_to_local_prune = false;
        if let Some(existing_release) = find_reusable_release(
            client,
            &build.application_id,
            &build_fingerprint,
            &context.env.server_id,
        )
        .await
        .map_err(TaskExecutionError::db_transition)?
        {
            let artifact_exists = image_exists_locally(&existing_release.artifact_digest)
                .await
                .map_err(TaskExecutionError::artifact_publish)?
                || image_exists_locally(&existing_release.artifact_ref)
                    .await
                    .map_err(TaskExecutionError::artifact_publish)?;
            if !artifact_exists {
                reuse_release_stage
                    .append_debug(&format!(
                        "release {} matched fingerprint but artifact is missing locally (ref={}, digest={})\n",
                        existing_release.release_id,
                        existing_release.artifact_ref,
                        existing_release.artifact_digest
                    ))
                    .await?;
                reuse_missed_due_to_local_prune = true;
            } else {
                let release_id = record_release(
                    client,
                    &build.build_id,
                    &build.application_id,
                    &existing_release.git_sha,
                    &existing_release.commit_message,
                    &existing_release.artifact_ref,
                    &existing_release.artifact_digest,
                    &existing_release.alive_toml_snapshot,
                    &build_fingerprint,
                )
                .await
                .map_err(TaskExecutionError::release_record)?;
                pipeline
                    .append_summary(&format!(
                        "reusing artifact from release {} as new release {} ({})\n",
                        existing_release.release_id, release_id, existing_release.artifact_digest
                    ))
                    .await?;
                pipeline
                    .emit(
                        TaskEventType::ReleaseReused,
                        json!({
                            "source_release_id": existing_release.release_id,
                            "release_id": release_id,
                            "artifact_ref": existing_release.artifact_ref,
                            "artifact_digest": existing_release.artifact_digest,
                            "git_sha": existing_release.git_sha,
                            "build_fingerprint": build_fingerprint,
                            "matched_release_fingerprint": existing_release.build_fingerprint,
                        }),
                    )
                    .await?;
                mark_build_succeeded(
                    client,
                    &build.build_id,
                    &build.lease_token,
                    &existing_release.git_sha,
                    &existing_release.commit_message,
                    &existing_release.alive_toml_snapshot,
                    &existing_release.artifact_ref,
                    &existing_release.artifact_digest,
                    &log_path,
                )
                .await
                .map_err(TaskExecutionError::db_transition)?;

                // Build is now marked succeeded in DB. All subsequent writes are
                // best-effort telemetry — never propagate errors that would flip
                // the build back to failed.
                if let Err(error) = pipeline
                    .emit(
                        TaskEventType::Succeeded,
                        json!({
                            "release_id": release_id,
                            "reused": true,
                            "build_fingerprint": build_fingerprint,
                        }),
                    )
                    .await
                {
                    tracing::warn!(
                        message = "post-success telemetry failed: emit succeeded event",
                        build_id = %build.build_id,
                        error = %format!("{:#}", error),
                    );
                }
                if let Err(error) = reuse_release_stage
                    .finish_ok(&format!(
                        "reused artifact from {} into {}",
                        existing_release.release_id, release_id
                    ))
                    .await
                {
                    tracing::warn!(
                        message = "post-success telemetry failed: finish reuse stage",
                        build_id = %build.build_id,
                        error = %format!("{:#}", error),
                    );
                }
                return Ok::<(), anyhow::Error>(());
            }
        }
        if reuse_missed_due_to_local_prune {
            reuse_release_stage
                .finish_ok("matching release found, but artifact is no longer present locally")
                .await?;
        } else {
            reuse_release_stage
                .finish_ok("no reusable release found")
                .await?;
        }

        let dockerfile_path = prepared_source
            .build_input
            .source_root
            .join(&prepared_source.alive_config.docker.dockerfile);
        assert_path_contained(
            &dockerfile_path,
            &prepared_source.build_input.source_root,
            "dockerfile",
        )
            .map_err(TaskExecutionError::build_validation)?;
        let build_context = prepared_source.build_input.build_context.clone();
        assert_path_contained(
            &build_context,
            &prepared_source.build_input.source_root,
            "docker context",
        )
            .map_err(TaskExecutionError::build_validation)?;
        let mut artifact = BuildArtifact::local_image(
            &prepared_source.alive_config.docker.image_repository,
            &prepared_source.build_input,
        )
        .map_err(TaskExecutionError::build_validation)?;
        let iid_file = context
            .data_dir
            .join("iids")
            .join(format!("{}.txt", build.build_id));
        let buildx_config_dir = context.data_dir.join("buildx-config");

        if tokio_fs::try_exists(&iid_file)
            .await
            .with_context(|| format!("failed to stat {}", iid_file.display()))
            .map_err(TaskExecutionError::build_image)?
        {
            tokio_fs::remove_file(&iid_file)
                .await
                .with_context(|| format!("failed to remove {}", iid_file.display()))
                .map_err(TaskExecutionError::build_image)?;
        }

        let build_image_stage = pipeline
            .start_stage(4, TaskStage::BuildImage, &format!("building {}", artifact.image_ref))
            .await?;
        let mut command = Command::new("docker");
        command
            .env("DOCKER_BUILDKIT", "1")
            .env("BUILDX_CONFIG", &buildx_config_dir)
            .arg("build")
            .arg("--file")
            .arg(&dockerfile_path)
            .arg("--target")
            .arg(&prepared_source.alive_config.docker.target)
            .arg("--tag")
            .arg(&artifact.image_ref)
            .arg("--iidfile")
            .arg(&iid_file);

        for secret in &build_secrets {
            command.arg("--secret").arg(format!(
                "id={},src={}",
                secret.id,
                secret.source.display()
            ));
        }

        for (name, value) in runtime_build_metadata(&prepared_source, build) {
            command.arg("--build-arg").arg(format!("{name}={value}"));
        }

        command.arg(&build_context);

        if let Err(error) = run_logged_command_with_timeout(
            command,
            build_image_stage.debug_path(),
            &format!("docker build {} ({})", build.build_id, artifact.image_ref),
            BUILD_TIMEOUT,
        )
        .await
        {
            let typed_error = TaskExecutionError::build_image(error);
            build_image_stage
                .finish_error(&typed_error.display_full())
                .await?;
            return Err(typed_error.into());
        }

        let local_image_id = tokio_fs::read_to_string(&iid_file)
            .await
            .with_context(|| format!("failed to read {}", iid_file.display()))
            .map_err(TaskExecutionError::build_image)?
            .trim()
            .to_string();
        artifact = artifact
            .with_local_image_id(local_image_id.clone())
            .map_err(TaskExecutionError::build_image)?;
        build_image_stage
            .append_debug(&format!("built local image id {}\n", local_image_id))
            .await?;
        build_image_stage
            .finish_ok(&format!("image built as {}", artifact.image_ref))
            .await?;

        let publish_stage = pipeline
            .start_stage(
                5,
                TaskStage::PublishArtifact,
                "resolving local artifact digest",
            )
            .await?;
        let artifact_digest = match resolve_local_artifact_digest(
            &artifact.image_ref,
            publish_stage.debug_path(),
        )
        .await
        {
                Ok(digest) => digest,
                Err(error) => {
                    let typed_error = TaskExecutionError::artifact_publish(error);
                    publish_stage
                        .finish_error(&typed_error.display_full())
                        .await?;
                    return Err(typed_error.into());
                }
            };
        artifact = artifact
            .with_artifact_digest(artifact_digest.clone())
            .map_err(TaskExecutionError::artifact_publish)?;
        pipeline
            .emit(
                TaskEventType::ArtifactPushed,
                json!({
                    "artifact_ref": artifact.image_ref,
                    "artifact_digest": artifact_digest,
                    "debug_log_path": publish_stage.debug_path().display().to_string(),
                }),
            )
            .await?;
        publish_stage
            .finish_ok(&format!("resolved {}", artifact_digest))
            .await?;

        let record_release_stage = pipeline
            .start_stage(
                6,
                TaskStage::RecordRelease,
                "recording release and marking build success",
            )
            .await?;
        let release_id = record_release(
            client,
            &build.build_id,
            &build.application_id,
            &prepared_source.build_input.release_git_sha,
            &prepared_source.build_input.release_commit_message,
            &artifact.image_ref,
            &artifact_digest,
            &prepared_source.alive_toml_snapshot,
            &build_fingerprint,
        )
        .await
        .map_err(TaskExecutionError::release_record)?;

        mark_build_succeeded(
            client,
            &build.build_id,
            &build.lease_token,
            &prepared_source.build_input.release_git_sha,
            &prepared_source.build_input.release_commit_message,
            &prepared_source.alive_toml_snapshot,
            &artifact.image_ref,
            &artifact_digest,
            &log_path,
        )
        .await
        .map_err(TaskExecutionError::db_transition)?;

        // Build is now marked succeeded in DB. All subsequent writes are
        // best-effort telemetry — never propagate errors that would flip
        // the build back to failed.
        if let Err(error) = pipeline
            .append_summary(&format!("release recorded: {}\n", release_id))
            .await
        {
            tracing::warn!(
                message = "post-success telemetry failed: append summary",
                build_id = %build.build_id,
                error = %format!("{:#}", error),
            );
        }
        if let Err(error) = pipeline
            .emit(
                TaskEventType::Succeeded,
                json!({ "release_id": release_id, "build_fingerprint": build_fingerprint }),
            )
            .await
        {
            tracing::warn!(
                message = "post-success telemetry failed: emit succeeded event",
                build_id = %build.build_id,
                error = %format!("{:#}", error),
            );
        }
        if let Err(error) = record_release_stage
            .finish_ok(&format!("release {}", release_id))
            .await
        {
            tracing::warn!(
                message = "post-success telemetry failed: finish record release stage",
                build_id = %build.build_id,
                error = %format!("{:#}", error),
            );
        }

        Ok::<(), anyhow::Error>(())
        },
    )
    .await;

    if let Err(cleanup_error) =
        cleanup_source_snapshot(&temp_source_dir, &temp_archive_path, &log_path).await
    {
        tracing::warn!(
            message = "source snapshot cleanup failed",
            build_id = %build.build_id,
            error = %format!("{:#}", cleanup_error),
        );
    }

    if let Err(error) = build_result {
        let error_display = format!("{:#}", error);
        pipeline.finish_failure(&error_display).await?;
        pipeline
            .emit(TaskEventType::Failed, json!({ "error": &error_display }))
            .await?;
        mark_build_failed(
            client,
            &build.build_id,
            &build.lease_token,
            &error_display,
            &log_path,
        )
        .await
        .map_err(TaskExecutionError::db_transition)?;
        return Err(error);
    }

    pipeline.finish_success("build succeeded").await?;
    Ok(())
}
