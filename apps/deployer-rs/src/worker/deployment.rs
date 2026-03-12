use anyhow::{anyhow, Result};
use serde_json::json;
use tokio::fs as tokio_fs;
use tokio::process::Command;
use tokio_postgres::Client;

use super::error::TaskExecutionError;
use super::with_lease_heartbeat;
use crate::config::{
    parse_alive_toml, policy_for_environment, prepare_runtime_bind_mount_source_async,
    resolve_bind_mount_source, resolve_runtime_env_file_async, runtime_network_mode,
    validate_runtime_policy, write_sanitized_env_file_async,
};
use crate::constants::LOCAL_BIND_IP;
use crate::db::{
    fetch_environment, fetch_release, mark_deployment_failed, mark_deployment_succeeded,
};
use crate::docker::{
    append_container_logs, container_is_running, deployment_container_name,
    discard_rollback_container, image_exists_locally, prepare_rollback_container,
    remove_container_if_exists, restore_rollback_container, stop_and_disable_systemd_unit,
    wait_for_container_stability, wait_for_health, wait_for_public_health,
};
use crate::logging::{
    append_log, append_task_event, deployment_event_path, deployment_log_path, prepare_log,
    TaskPipeline,
};
use crate::types::{
    ClaimedDeployment, LeaseTarget, RuntimeNetworkMode, ServiceContext, TaskEventType, TaskKind,
    TaskStage,
};
use crate::workspace_contract::{DeployRequest, RuntimeKind, RuntimeTarget, WorkspaceScope};

pub(super) async fn reconcile_running_deployments(
    client: &Client,
    context: &ServiceContext,
) -> Result<()> {
    let rows = client
        .query(
            "
            SELECT deployments.deployment_id, deployments.environment_id, deployments.release_id
            FROM deploy.deployments AS deployments
            INNER JOIN deploy.environments AS environments
              ON environments.environment_id = deployments.environment_id
            WHERE deployments.status = 'running'::deploy.task_status
              AND environments.server_id = $1
            ",
            &[&context.env.server_id],
        )
        .await?;

    for row in rows {
        let deployment = ClaimedDeployment {
            deployment_id: row.get(0),
            environment_id: row.get(1),
            release_id: row.get(2),
        };
        let environment = fetch_environment(client, &deployment.environment_id).await?;
        let release = fetch_release(client, &deployment.release_id).await?;
        let config = parse_alive_toml(&release.alive_toml_snapshot)?;
        let container_name = deployment_container_name(&config.project.slug, &environment.name);
        if container_is_running(&container_name).await? {
            continue;
        }

        let log_path = deployment_log_path(&context.data_dir, &deployment.deployment_id);
        let event_path = deployment_event_path(&context.data_dir, &deployment.deployment_id);
        if tokio_fs::try_exists(&log_path).await? {
            append_log(
                &log_path,
                &format!(
                    "reconciliation detected missing or stopped container {}\n",
                    container_name
                ),
            )
            .await?;
        } else {
            prepare_log(
                &log_path,
                &format!(
                    "reconciliation detected missing or stopped container {}",
                    container_name
                ),
            )
            .await?;
        }
        append_task_event(
            &event_path,
            TaskKind::Deployment,
            &deployment.deployment_id,
            TaskEventType::ReconciledMissingContainer,
            json!({ "container_name": container_name }),
        )
        .await?;
        mark_deployment_failed(
            client,
            &deployment.deployment_id,
            &format!(
                "reconciliation failed deployment because container {} was not running",
                container_name
            ),
            None,
            &log_path,
        )
        .await
        .map_err(TaskExecutionError::db_transition)?;
    }

    Ok(())
}

pub(super) async fn process_deployment(
    client: &Client,
    context: &ServiceContext,
    deployment: &ClaimedDeployment,
) -> Result<()> {
    let pipeline = TaskPipeline::for_deployment(&context.data_dir, &deployment.deployment_id);
    let log_path = pipeline.summary_path().to_path_buf();
    pipeline
        .prepare(&format!("deployment {} started", deployment.deployment_id))
        .await?;
    pipeline
        .emit(
            TaskEventType::Started,
            json!({
                "environment_id": deployment.environment_id,
                "release_id": deployment.release_id
            }),
        )
        .await?;

    let environment = fetch_environment(client, &deployment.environment_id).await?;
    let release = fetch_release(client, &deployment.release_id).await?;

    if environment.server_id != context.env.server_id {
        let typed_error = TaskExecutionError::deployment_validation(anyhow!(
            "deployment {} targets server {} but this worker is {}",
            deployment.deployment_id,
            environment.server_id,
            context.env.server_id
        ));
        mark_deployment_failed(
            client,
            &deployment.deployment_id,
            &typed_error.display_full(),
            None,
            &log_path,
        )
        .await
        .map_err(TaskExecutionError::db_transition)?;
        pipeline.finish_failure(&typed_error.display_full()).await?;
        pipeline
            .emit(
                TaskEventType::Failed,
                json!({ "error": typed_error.display_full(), "reason": "server_mismatch" }),
            )
            .await?;
        return Err(typed_error.into());
    }

    if environment.application_id != release.application_id {
        let typed_error = TaskExecutionError::deployment_validation(anyhow!(
            "release {} does not belong to environment {}",
            release.release_id,
            environment.environment_id
        ));
        mark_deployment_failed(
            client,
            &deployment.deployment_id,
            &typed_error.display_full(),
            None,
            &log_path,
        )
        .await
        .map_err(TaskExecutionError::db_transition)?;
        pipeline.finish_failure(&typed_error.display_full()).await?;
        pipeline
            .emit(
                TaskEventType::Failed,
                json!({ "error": typed_error.display_full(), "reason": "release_mismatch" }),
            )
            .await?;
        return Err(typed_error.into());
    }

    let config = parse_alive_toml(&release.alive_toml_snapshot)
        .map_err(TaskExecutionError::deployment_validation)?;
    let workspace_scope = WorkspaceScope::from_environment(&environment)
        .map_err(TaskExecutionError::deployment_validation)?;
    let runtime_target = RuntimeTarget::for_environment(RuntimeKind::Host, &environment)
        .map_err(TaskExecutionError::deployment_validation)?;
    let deploy_request =
        DeployRequest::from_release(workspace_scope.clone(), &release, runtime_target.clone())
            .map_err(TaskExecutionError::deployment_validation)?;
    pipeline
        .emit(
            TaskEventType::DeployRequestPrepared,
            json!({
                "organization_id": deploy_request.desired_snapshot.scope.organization_id.as_str(),
                "workspace_id": deploy_request.desired_snapshot.scope.workspace_id.as_str(),
                "snapshot_id": deploy_request.desired_snapshot.snapshot_id.as_str(),
                "policy_version": deploy_request.desired_snapshot.policy_version.as_str(),
                "runtime": deploy_request.runtime_target.runtime,
                "server_id": deploy_request.runtime_target.server_id,
                "environment": deploy_request.runtime_target.environment,
                "hostname": deploy_request.runtime_target.hostname,
                "port": deploy_request.runtime_target.port,
            }),
        )
        .await?;
    let policy = policy_for_environment(&config, &environment.name)
        .map_err(TaskExecutionError::runtime_preparation)?;
    validate_runtime_policy(&environment.name, policy)
        .map_err(TaskExecutionError::runtime_preparation)?;
    let env_file =
        resolve_runtime_env_file_async(config.clone(), environment.clone(), context.clone())
            .await
            .map_err(TaskExecutionError::runtime_preparation)?;
    let sanitized_env_file = context
        .data_dir
        .join("runtime-env")
        .join(format!("{}.env", deployment.deployment_id));
    let container_name = deployment_container_name(&config.project.slug, &environment.name);
    let host_port = u16::try_from(environment.port)
        .map_err(|error| TaskExecutionError::deployment_validation(anyhow!(error)))?;
    let network_mode =
        runtime_network_mode(&config.runtime).map_err(TaskExecutionError::runtime_preparation)?;
    let runtime_port = match network_mode {
        RuntimeNetworkMode::Bridge => config.runtime.container_port,
        RuntimeNetworkMode::Host => host_port,
    };
    let mut rollback_container = None;

    let deploy_result = with_lease_heartbeat(
        client,
        LeaseTarget::Deployment,
        &deployment.deployment_id,
        async {
            pipeline
                .append_summary(&format!(
                    "deploying artifact {} to {}:{}\n",
                    release.artifact_ref, environment.hostname, environment.port
                ))
                .await?;
            let prepare_runtime_stage = pipeline
                .start_stage(
                    1,
                    TaskStage::PrepareRuntime,
                    "sanitizing runtime environment",
                )
                .await?;
            if let Err(error) = write_sanitized_env_file_async(
                &env_file,
                &sanitized_env_file,
                policy.clone(),
                environment.allow_email,
                runtime_port,
            )
            .await
            {
                let typed_error = TaskExecutionError::runtime_preparation(error);
                prepare_runtime_stage
                    .finish_error(&typed_error.display_full())
                    .await?;
                return Err(typed_error.into());
            }
            pipeline
                .emit(
                    TaskEventType::RuntimeEnvPrepared,
                    json!({
                        "env_file": sanitized_env_file.display().to_string(),
                        "debug_log_path": prepare_runtime_stage.debug_path().display().to_string(),
                    }),
                )
                .await?;
            prepare_runtime_stage
                .finish_ok(&format!(
                    "runtime env ready at {}",
                    sanitized_env_file.display()
                ))
                .await?;

            let pull_artifact_stage = pipeline
                .start_stage(2, TaskStage::PullArtifact, "verifying artifact available locally")
                .await?;
            let digest_exists = image_exists_locally(&release.artifact_digest).await?;
            let ref_exists = image_exists_locally(&release.artifact_ref).await?;
            if digest_exists || ref_exists {
                pull_artifact_stage
                    .append_debug(&format!(
                        "artifact available locally (ref_exists={}, digest_exists={}, ref={}, digest={})\n",
                        ref_exists, digest_exists, release.artifact_ref, release.artifact_digest
                    ))
                    .await?;
            } else {
                let typed_error = TaskExecutionError::artifact_pull(anyhow!(
                    "artifact missing locally on server {}: ref={} digest={}",
                    context.env.server_id,
                    release.artifact_ref,
                    release.artifact_digest
                ));
                pull_artifact_stage
                    .finish_error(&typed_error.display_full())
                    .await?;
                return Err(typed_error.into());
            }
            pipeline
                .emit(
                    TaskEventType::ArtifactPulled,
                    json!({
                        "artifact_ref": release.artifact_ref,
                        "artifact_digest": release.artifact_digest,
                        "debug_log_path": pull_artifact_stage.debug_path().display().to_string(),
                    }),
                )
                .await?;
            pull_artifact_stage
                .finish_ok(&format!("verified {}", release.artifact_digest))
                .await?;

            let reserve_rollback_stage = pipeline
                .start_stage(
                    3,
                    TaskStage::ReserveRollback,
                    "reserving previous container for rollback",
                )
                .await?;
            // Stop the systemd service that previously owned this port.
            // The deployer-rs Docker container is the new owner.
            let systemd_unit = format!("alive-{}.service", environment.name);
            stop_and_disable_systemd_unit(&systemd_unit, reserve_rollback_stage.debug_path())
                .await
                .map_err(TaskExecutionError::rollback_preparation)?;

            rollback_container = match prepare_rollback_container(
                &container_name,
                &deployment.deployment_id,
                reserve_rollback_stage.debug_path(),
            )
            .await
            {
                Ok(container) => container,
                Err(error) => {
                    let typed_error = TaskExecutionError::rollback_preparation(error);
                    reserve_rollback_stage
                        .finish_error(&typed_error.display_full())
                        .await?;
                    return Err(typed_error.into());
                }
            };
            pipeline
                .emit(
                    TaskEventType::RollbackReserved,
                    json!({
                        "container_name": container_name,
                        "debug_log_path": reserve_rollback_stage.debug_path().display().to_string(),
                    }),
                )
                .await?;
            reserve_rollback_stage
                .finish_ok(if rollback_container.is_some() {
                    "reserved previous container"
                } else {
                    "no previous container to reserve"
                })
                .await?;

            let start_container_stage = pipeline
                .start_stage(4, TaskStage::StartContainer, "starting container")
                .await?;
            let mut command = Command::new("docker");
            command
                .arg("run")
                .arg("--detach")
                .arg("--name")
                .arg(&container_name)
                .arg("--restart")
                .arg("unless-stopped")
                .arg("--env-file")
                .arg(&sanitized_env_file)
                .arg("--label")
                .arg(format!("alive.application={}", config.project.slug))
                .arg("--label")
                .arg(format!("alive.environment={}", environment.name))
                .arg("--label")
                .arg("alive.managed_by=alive-deployer")
                .arg("--label")
                .arg(format!("alive.deployment_id={}", deployment.deployment_id))
                .arg("--label")
                .arg(format!("alive.release_id={}", release.release_id));

            match network_mode {
                RuntimeNetworkMode::Bridge => {
                    command.arg("--publish").arg(format!(
                        "{}:{}:{}",
                        LOCAL_BIND_IP, host_port, config.runtime.container_port
                    ));
                }
                RuntimeNetworkMode::Host => {
                    command.arg("--network").arg("host");
                }
            }

            let staged_bind_mount_root = context
                .data_dir
                .join("bind-mounts")
                .join(&deployment.deployment_id);
            for bind_mount in &config.runtime.bind_mounts {
                let original_source = resolve_bind_mount_source(bind_mount, context)
                    .map_err(TaskExecutionError::runtime_preparation)?;
                let source = prepare_runtime_bind_mount_source_async(
                    &original_source,
                    bind_mount.clone(),
                    &staged_bind_mount_root,
                )
                .await
                .map_err(TaskExecutionError::runtime_preparation)?;
                let mount_spec = if bind_mount.read_only {
                    format!("{}:{}:ro", source.display(), bind_mount.target)
                } else {
                    format!("{}:{}", source.display(), bind_mount.target)
                };
                command.arg("--volume").arg(mount_spec);
            }

            command.arg(&release.artifact_ref);

            if let Err(error) = crate::logging::run_logged_command(
                command,
                start_container_stage.debug_path(),
                &format!(
                    "docker run {} ({})",
                    deployment.deployment_id, container_name
                ),
            )
            .await
            {
                let typed_error = TaskExecutionError::runtime_start(error);
                start_container_stage
                    .finish_error(&typed_error.display_full())
                    .await?;
                return Err(typed_error.into());
            }
            pipeline
                .emit(
                    TaskEventType::ContainerStarted,
                    json!({
                        "container_name": container_name,
                        "debug_log_path": start_container_stage.debug_path().display().to_string(),
                    }),
                )
                .await?;
            start_container_stage
                .finish_ok(&format!("container {}", container_name))
                .await?;

            let health_path = if environment.healthcheck_path.is_empty() {
                config.runtime.healthcheck_path.as_str()
            } else {
                environment.healthcheck_path.as_str()
            };

            let local_health_stage = pipeline
                .start_stage(5, TaskStage::LocalHealth, "waiting for localhost health")
                .await?;
            if let Err(error) =
                wait_for_health(host_port, health_path, local_health_stage.debug_path()).await
            {
                let typed_error = TaskExecutionError::local_health(error);
                local_health_stage
                    .finish_error(&typed_error.display_full())
                    .await?;
                return Err(typed_error.into());
            }
            pipeline
                .emit(
                    TaskEventType::LocalHealthPassed,
                    json!({
                        "port": host_port,
                        "health_path": health_path,
                        "debug_log_path": local_health_stage.debug_path().display().to_string(),
                    }),
                )
                .await?;
            local_health_stage.finish_ok("local health passed").await?;

            let stability_stage = pipeline
                .start_stage(6, TaskStage::Stability, "waiting for stabilization window")
                .await?;
            let stabilized_status = match wait_for_container_stability(
                &container_name,
                host_port,
                health_path,
                stability_stage.debug_path(),
            )
            .await
            {
                Ok(status) => status,
                Err(error) => {
                    let typed_error = TaskExecutionError::stability(error);
                    stability_stage
                        .finish_error(&typed_error.display_full())
                        .await?;
                    return Err(typed_error.into());
                }
            };
            stability_stage
                .finish_ok(&format!(
                    "stabilized with HTTP {}",
                    stabilized_status.as_u16()
                ))
                .await?;

            let public_health_stage = pipeline
                .start_stage(7, TaskStage::PublicHealth, "verifying public route health")
                .await?;
            if let Err(error) = wait_for_public_health(
                &environment.hostname,
                health_path,
                public_health_stage.debug_path(),
            )
            .await
            {
                let typed_error = TaskExecutionError::public_health(error);
                public_health_stage
                    .finish_error(&typed_error.display_full())
                    .await?;
                return Err(typed_error.into());
            }
            pipeline
                .emit(
                    TaskEventType::PublicHealthPassed,
                    json!({
                        "hostname": environment.hostname,
                        "health_path": health_path,
                        "debug_log_path": public_health_stage.debug_path().display().to_string(),
                    }),
                )
                .await?;
            public_health_stage
                .finish_ok("public health passed")
                .await?;
            mark_deployment_succeeded(
                client,
                &deployment.deployment_id,
                stabilized_status.as_u16().into(),
                &log_path,
            )
            .await
            .map_err(TaskExecutionError::db_transition)?;
            pipeline
                .emit(
                    TaskEventType::Succeeded,
                    json!({ "status_code": stabilized_status.as_u16() }),
                )
                .await?;

            Ok::<(), anyhow::Error>(())
        },
    )
    .await;

    if let Err(error) = deploy_result {
        let rollback_stage = pipeline
            .start_stage(
                90,
                TaskStage::Rollback,
                "capturing failure details and restoring previous container",
            )
            .await?;
        let _ = append_container_logs(&container_name, rollback_stage.debug_path()).await;
        let _ = remove_container_if_exists(&container_name, rollback_stage.debug_path()).await;
        let mut failure_message = format!("{:#}", error);
        if let Some(previous_container) = rollback_container.as_ref() {
            if let Err(restore_error) =
                restore_rollback_container(previous_container, rollback_stage.debug_path()).await
            {
                let typed_error = TaskExecutionError::rollback(restore_error);
                failure_message = format!("{}; {}", failure_message, typed_error);
                rollback_stage.finish_error(&failure_message).await?;
            } else {
                pipeline
                    .emit(
                        TaskEventType::RollbackRestored,
                        json!({ "container_name": previous_container.original_name }),
                    )
                    .await?;
                rollback_stage
                    .finish_ok(&format!("restored {}", previous_container.original_name))
                    .await?;
            }
        } else {
            rollback_stage
                .finish_ok("cleaned failed deployment; no previous container to restore")
                .await?;
        }
        mark_deployment_failed(
            client,
            &deployment.deployment_id,
            &failure_message,
            None,
            &log_path,
        )
        .await
        .map_err(TaskExecutionError::db_transition)?;
        pipeline.finish_failure(&failure_message).await?;
        pipeline
            .emit(TaskEventType::Failed, json!({ "error": failure_message }))
            .await?;
        return Err(TaskExecutionError::rollback(anyhow!(failure_message)).into());
    }

    if let Some(previous_container) = rollback_container.as_ref() {
        if let Err(cleanup_error) = discard_rollback_container(previous_container, &log_path).await
        {
            append_log(
                &log_path,
                &format!("rollback container cleanup warning: {}\n", cleanup_error),
            )
            .await?;
        }
    }

    pipeline.finish_success("deployment succeeded").await?;
    Ok(())
}
