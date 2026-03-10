use anyhow::{anyhow, Context, Result};
use serde_json::json;
use tokio::fs as tokio_fs;
use tokio::process::Command;
use tokio_postgres::Client;

use super::error::TaskExecutionError;
use super::with_lease_heartbeat;
use crate::config::{parse_alive_toml, resolve_build_secrets, validate_application_matches_config};
use crate::db::{
    fetch_application, find_reusable_release, mark_build_failed, mark_build_succeeded,
    record_release,
};
use crate::docker::push_image_and_resolve_artifact_digest;
use crate::fingerprint::compute_build_fingerprint;
use crate::github::{cleanup_source_snapshot, export_github_snapshot, resolve_github_commit};
use crate::logging::{run_logged_command, TaskPipeline};
use crate::types::{ClaimedBuild, LeaseTarget, ServiceContext, TaskEventType, TaskStage};

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
    let resolve_stage = pipeline
        .start_stage(1, TaskStage::ResolveCommit, "resolving git ref")
        .await?;
    let resolved_commit =
        match resolve_github_commit(&application, &build.git_ref, resolve_stage.debug_path()).await
        {
            Ok(commit) => {
                pipeline
                    .emit(
                        TaskEventType::CommitResolved,
                        json!({
                            "git_sha": commit.sha,
                            "repo_owner": application.repo_owner,
                            "repo_name": application.repo_name,
                            "debug_log_path": resolve_stage.debug_path().display().to_string(),
                        }),
                    )
                    .await?;
                resolve_stage
                    .finish_ok(&format!("resolved {} to {}", build.git_ref, commit.sha))
                    .await?;
                commit
            }
            Err(error) => {
                let typed_error = TaskExecutionError::source_resolution(error);
                resolve_stage.finish_error(&typed_error.to_string()).await?;
                pipeline
                    .emit(
                        TaskEventType::Failed,
                        json!({ "error": typed_error.to_string() }),
                    )
                    .await?;
                mark_build_failed(client, &build.build_id, &typed_error.to_string(), &log_path)
                    .await
                    .map_err(TaskExecutionError::db_transition)?;
                return Err(typed_error.into());
            }
        };
    let short_sha = resolved_commit.sha.chars().take(12).collect::<String>();
    let source_dir = context.data_dir.join("sources").join(&build.build_id);
    let archive_path = context
        .data_dir
        .join("archives")
        .join(format!("{}.tar.gz", build.build_id));

    let build_result = with_lease_heartbeat(client, LeaseTarget::Build, &build.build_id, async {
        let prepare_source_stage = pipeline
            .start_stage(
                2,
                TaskStage::PrepareSource,
                "exporting source snapshot and validating config",
            )
            .await?;
        if let Err(error) = export_github_snapshot(
            &application,
            &source_dir,
            &archive_path,
            &resolved_commit.sha,
            prepare_source_stage.debug_path(),
        )
        .await
        {
            let typed_error = TaskExecutionError::source_snapshot(error);
            prepare_source_stage
                .finish_error(&typed_error.to_string())
                .await?;
            return Err(typed_error.into());
        }

        let config_path = source_dir.join(&application.config_path);
        let config_metadata = tokio_fs::metadata(&config_path).await;
        if !matches!(config_metadata, Ok(metadata) if metadata.is_file()) {
            let typed_error = TaskExecutionError::build_validation(anyhow!(
                "git ref {} does not contain required config {}",
                resolved_commit.sha,
                application.config_path
            ));
            prepare_source_stage
                .finish_error(&typed_error.to_string())
                .await?;
            return Err(typed_error.into());
        }
        let alive_toml_snapshot = tokio_fs::read_to_string(&config_path)
            .await
            .with_context(|| format!("failed to read {}", config_path.display()))
            .map_err(TaskExecutionError::source_snapshot)?;
        let alive_config = match parse_alive_toml(&alive_toml_snapshot) {
            Ok(config) => config,
            Err(error) => {
                let typed_error = TaskExecutionError::build_validation(error);
                prepare_source_stage
                    .finish_error(&typed_error.to_string())
                    .await?;
                return Err(typed_error.into());
            }
        };

        if let Err(error) = validate_application_matches_config(&application, &alive_config) {
            let typed_error = TaskExecutionError::build_validation(error);
            prepare_source_stage
                .finish_error(&typed_error.to_string())
                .await?;
            return Err(typed_error.into());
        }
        pipeline
            .append_summary(&format!(
                "building {} from {}/{} (default branch: {})\n",
                application.display_name,
                application.repo_owner,
                application.repo_name,
                application.default_branch
            ))
            .await?;
        prepare_source_stage
            .finish_ok(&format!("validated {}", config_path.display()))
            .await?;

        let build_secrets = resolve_build_secrets(&context.repo_root, &alive_config, &context.env)
            .map_err(TaskExecutionError::build_validation)?;
        let build_fingerprint = compute_build_fingerprint(
            &resolved_commit.sha,
            &application.config_path,
            &alive_toml_snapshot,
            &alive_config,
            &build_secrets,
        )
        .await
        .map_err(TaskExecutionError::build_fingerprint)?;

        let reuse_release_stage = pipeline
            .start_stage(3, TaskStage::ReuseRelease, "checking for reusable release")
            .await?;
        if let Some(existing_release) =
            find_reusable_release(client, &build.application_id, &build_fingerprint)
                .await
                .map_err(TaskExecutionError::db_transition)?
        {
            pipeline
                .append_summary(&format!(
                    "reusing existing release {} ({})\n",
                    existing_release.release_id, existing_release.artifact_digest
                ))
                .await?;
            pipeline
                .emit(
                    TaskEventType::ReleaseReused,
                    json!({
                        "release_id": existing_release.release_id,
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
                &existing_release.git_sha,
                &existing_release.commit_message,
                &existing_release.alive_toml_snapshot,
                &existing_release.artifact_ref,
                &existing_release.artifact_digest,
                &log_path,
            )
            .await
            .map_err(TaskExecutionError::db_transition)?;
            pipeline
                .emit(
                    TaskEventType::Succeeded,
                    json!({
                        "release_id": existing_release.release_id,
                        "reused": true,
                        "build_fingerprint": build_fingerprint,
                    }),
                )
                .await?;
            reuse_release_stage
                .finish_ok(&format!("reused release {}", existing_release.release_id))
                .await?;
            return Ok::<(), anyhow::Error>(());
        }
        reuse_release_stage
            .finish_ok("no reusable release found")
            .await?;

        let dockerfile_path = source_dir.join(&alive_config.docker.dockerfile);
        let build_context = source_dir.join(&alive_config.docker.context);
        let image_ref = format!("{}:{}", alive_config.docker.image_repository, short_sha);
        let iid_file = context
            .data_dir
            .join("iids")
            .join(format!("{}.txt", build.build_id));

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
            .start_stage(4, TaskStage::BuildImage, &format!("building {}", image_ref))
            .await?;
        let mut command = Command::new("docker");
        command
            .env("DOCKER_BUILDKIT", "1")
            .arg("build")
            .arg("--file")
            .arg(&dockerfile_path)
            .arg("--target")
            .arg(&alive_config.docker.target)
            .arg("--tag")
            .arg(&image_ref)
            .arg("--iidfile")
            .arg(&iid_file);

        for secret in &build_secrets {
            command.arg("--secret").arg(format!(
                "id={},src={}",
                secret.id,
                secret.source.display()
            ));
        }

        command.arg(&build_context);

        if let Err(error) = run_logged_command(
            command,
            build_image_stage.debug_path(),
            &format!("docker build {} ({})", build.build_id, image_ref),
        )
        .await
        {
            let typed_error = TaskExecutionError::build_image(error);
            build_image_stage
                .finish_error(&typed_error.to_string())
                .await?;
            return Err(typed_error.into());
        }

        let local_image_id = tokio_fs::read_to_string(&iid_file)
            .await
            .with_context(|| format!("failed to read {}", iid_file.display()))
            .map_err(TaskExecutionError::build_image)?
            .trim()
            .to_string();
        build_image_stage
            .append_debug(&format!("built local image id {}\n", local_image_id))
            .await?;
        build_image_stage
            .finish_ok(&format!("image built as {}", image_ref))
            .await?;

        let publish_stage = pipeline
            .start_stage(
                5,
                TaskStage::PublishArtifact,
                "pushing artifact and resolving digest",
            )
            .await?;
        let artifact_digest =
            match push_image_and_resolve_artifact_digest(&image_ref, publish_stage.debug_path())
                .await
            {
                Ok(digest) => digest,
                Err(error) => {
                    let typed_error = TaskExecutionError::artifact_publish(error);
                    publish_stage.finish_error(&typed_error.to_string()).await?;
                    return Err(typed_error.into());
                }
            };
        pipeline
            .emit(
                TaskEventType::ArtifactPushed,
                json!({
                    "artifact_ref": image_ref,
                    "artifact_digest": artifact_digest,
                    "debug_log_path": publish_stage.debug_path().display().to_string(),
                }),
            )
            .await?;
        publish_stage
            .finish_ok(&format!("published {}", artifact_digest))
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
            &resolved_commit.sha,
            &resolved_commit.commit.message,
            &image_ref,
            &artifact_digest,
            &alive_toml_snapshot,
            &build_fingerprint,
        )
        .await
        .map_err(TaskExecutionError::release_record)?;

        mark_build_succeeded(
            client,
            &build.build_id,
            &resolved_commit.sha,
            &resolved_commit.commit.message,
            &alive_toml_snapshot,
            &image_ref,
            &artifact_digest,
            &log_path,
        )
        .await
        .map_err(TaskExecutionError::db_transition)?;

        pipeline
            .append_summary(&format!("release recorded: {}\n", release_id))
            .await?;
        pipeline
            .emit(
                TaskEventType::Succeeded,
                json!({ "release_id": release_id, "build_fingerprint": build_fingerprint }),
            )
            .await?;
        record_release_stage
            .finish_ok(&format!("release {}", release_id))
            .await?;

        Ok::<(), anyhow::Error>(())
    })
    .await;

    cleanup_source_snapshot(&source_dir, &archive_path, &log_path)
        .await
        .map_err(TaskExecutionError::source_snapshot)?;

    if let Err(error) = build_result {
        pipeline.finish_failure(&error.to_string()).await?;
        pipeline
            .emit(TaskEventType::Failed, json!({ "error": error.to_string() }))
            .await?;
        mark_build_failed(client, &build.build_id, &error.to_string(), &log_path)
            .await
            .map_err(TaskExecutionError::db_transition)?;
        return Err(error);
    }

    pipeline.finish_success("build succeeded").await?;
    Ok(())
}
