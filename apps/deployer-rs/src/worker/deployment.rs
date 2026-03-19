use anyhow::{anyhow, Result};
use serde_json::json;
use tokio::fs as tokio_fs;
use tokio_postgres::Client;

use super::error::TaskExecutionError;
use super::with_lease_heartbeat;
use crate::config::{
    parse_alive_toml, policy_for_environment, resolve_runtime_env_file_async, runtime_network_mode,
    validate_runtime_policy, write_sanitized_env_file_async,
};
use crate::db::{
    fetch_environment, fetch_release, mark_deployment_failed, mark_deployment_succeeded,
};
use crate::logging::{
    append_log, append_task_event, deployment_event_path, deployment_log_path, prepare_log,
    TaskPipeline,
};
use crate::runtime_adapter::{ResolvedRuntimeAdapter, RuntimeAdapter};
use crate::types::{
    ClaimedDeployment, DeployParams, LeaseTarget, RollbackState, ServiceContext, TaskEventType,
    TaskKind, TaskStage,
};
use crate::workspace_contract::{DeployRequest, WorkspaceScope};

pub(super) async fn reconcile_running_deployments(
    client: &Client,
    context: &ServiceContext,
) -> Result<()> {
    let rows = client
        .query(
            "
            SELECT deployments.deployment_id, deployments.environment_id, deployments.release_id, deployments.lease_token
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
            lease_token: row.get(3),
        };
        let environment = fetch_environment(client, &deployment.environment_id).await?;
        let release = fetch_release(client, &deployment.release_id).await?;
        let config = parse_alive_toml(&release.alive_toml_snapshot)?;

        let adapter = ResolvedRuntimeAdapter::from_config(config.runtime.kind)?;
        let is_running = adapter.is_running(&config, &environment.name).await?;

        if is_running {
            continue;
        }

        let label = adapter.runtime_label(&config, &environment.name);
        let log_path = deployment_log_path(&context.data_dir, &deployment.deployment_id);
        let event_path = deployment_event_path(&context.data_dir, &deployment.deployment_id);
        if tokio_fs::try_exists(&log_path).await? {
            append_log(&log_path, &format!("reconciliation detected stopped runtime {}\n", label)).await?;
        } else {
            prepare_log(&log_path, &format!("reconciliation detected stopped runtime {}", label)).await?;
        }
        append_task_event(
            &event_path,
            TaskKind::Deployment,
            &deployment.deployment_id,
            TaskEventType::ReconciledMissingContainer,
            json!({ "container_name": label.to_string() }),
        )
        .await?;
        mark_deployment_failed(
            client,
            &deployment.deployment_id,
            &deployment.lease_token,
            &format!("reconciliation failed deployment because runtime {} was not running", label),
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
            deployment.deployment_id, environment.server_id, context.env.server_id
        ));
        mark_deployment_failed(
            client, &deployment.deployment_id, &deployment.lease_token,
            &typed_error.display_full(), None, &log_path,
        ).await.map_err(TaskExecutionError::db_transition)?;
        pipeline.finish_failure(&typed_error.display_full()).await?;
        pipeline.emit(TaskEventType::Failed, json!({ "error": typed_error.display_full(), "reason": "server_mismatch" })).await?;
        return Err(typed_error.into());
    }

    if environment.application_id != release.application_id {
        let typed_error = TaskExecutionError::deployment_validation(anyhow!(
            "release {} does not belong to environment {}",
            release.release_id, environment.environment_id
        ));
        mark_deployment_failed(
            client, &deployment.deployment_id, &deployment.lease_token,
            &typed_error.display_full(), None, &log_path,
        ).await.map_err(TaskExecutionError::db_transition)?;
        pipeline.finish_failure(&typed_error.display_full()).await?;
        pipeline.emit(TaskEventType::Failed, json!({ "error": typed_error.display_full(), "reason": "release_mismatch" })).await?;
        return Err(typed_error.into());
    }

    let config = parse_alive_toml(&release.alive_toml_snapshot)
        .map_err(TaskExecutionError::deployment_validation)?;
    let adapter = ResolvedRuntimeAdapter::from_config(config.runtime.kind)
        .map_err(TaskExecutionError::deployment_validation)?;
    let workspace_scope = WorkspaceScope::from_environment(&environment)
        .map_err(TaskExecutionError::deployment_validation)?;
    let runtime_target = adapter
        .target_for_environment(&environment)
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
    let host_port = u16::try_from(environment.port)
        .map_err(|error| TaskExecutionError::deployment_validation(anyhow!(error)))?;
    let network_mode =
        runtime_network_mode(&config.runtime).map_err(TaskExecutionError::runtime_preparation)?;
    let runtime_port = adapter
        .runtime_port(&environment, &config.runtime, network_mode)
        .map_err(TaskExecutionError::runtime_preparation)?;

    let deploy_params = DeployParams {
        config: &config,
        environment: &environment,
        release: &release,
        deployment_id: &deployment.deployment_id,
        context,
        sanitized_env_file: &sanitized_env_file,
        host_port,
        network_mode,
    };

    let mut rollback_state = RollbackState::None;

    let deploy_result = with_lease_heartbeat(
        client,
        LeaseTarget::Deployment,
        &deployment.deployment_id,
        &deployment.lease_token,
        async {
            pipeline
                .append_summary(&format!(
                    "deploying artifact {} to {}:{}\n",
                    release.artifact_ref, environment.hostname, environment.port
                ))
                .await?;

            // === Stage 1: Prepare runtime env ===
            let prepare_stage = pipeline
                .start_stage(1, TaskStage::PrepareRuntime, "sanitizing runtime environment")
                .await?;
            write_sanitized_env_file_async(
                &env_file, &sanitized_env_file, policy.clone(),
                environment.allow_email, runtime_port,
            ).await.map_err(|e| TaskExecutionError::runtime_preparation(e))?;
            prepare_stage.finish_ok(&format!("runtime env ready at {}", sanitized_env_file.display())).await?;

            // === Stage 2: Verify artifact ===
            let verify_stage = pipeline
                .start_stage(2, TaskStage::PullArtifact, "verifying artifact available")
                .await?;
            adapter.verify_artifact(&deploy_params, verify_stage.debug_path())
                .await
                .map_err(TaskExecutionError::artifact_pull)?;
            verify_stage.finish_ok("artifact verified").await?;

            // === Stage 3: Reserve rollback ===
            let reserve_stage = pipeline
                .start_stage(3, TaskStage::ReserveRollback, "reserving previous state for rollback")
                .await?;
            rollback_state = adapter.prepare_rollback(&deploy_params, reserve_stage.debug_path())
                .await
                .map_err(TaskExecutionError::rollback_preparation)?;
            reserve_stage.finish_ok(match &rollback_state {
                RollbackState::Container(_) => "reserved previous container",
                RollbackState::Symlink(s) if s.previous_target.is_some() => "recorded current symlink",
                _ => "no previous state to reserve",
            }).await?;

            // === Stage 4: Activate ===
            let activate_stage = pipeline
                .start_stage(4, TaskStage::StartContainer, "activating new release")
                .await?;
            adapter.activate(&deploy_params, activate_stage.debug_path())
                .await
                .map_err(TaskExecutionError::runtime_start)?;
            activate_stage.finish_ok("activated").await?;

            // === Stage 5: Local health ===
            let local_health_stage = pipeline
                .start_stage(5, TaskStage::LocalHealth, "waiting for localhost health")
                .await?;
            adapter.wait_for_local_health(&deploy_params, local_health_stage.debug_path())
                .await
                .map_err(TaskExecutionError::local_health)?;
            local_health_stage.finish_ok("local health passed").await?;

            // === Stage 6: Stability ===
            let stability_stage = pipeline
                .start_stage(6, TaskStage::Stability, "waiting for stabilization window")
                .await?;
            let stabilized_status = adapter
                .wait_for_stability(&deploy_params, stability_stage.debug_path())
                .await
                .map_err(TaskExecutionError::stability)?;
            stability_stage.finish_ok(&format!("stabilized with HTTP {}", stabilized_status.as_u16())).await?;

            // === Stage 7: Public health ===
            let public_health_stage = pipeline
                .start_stage(7, TaskStage::PublicHealth, "verifying public route health")
                .await?;
            adapter.wait_for_public_health(&deploy_params, public_health_stage.debug_path())
                .await
                .map_err(TaskExecutionError::public_health)?;
            public_health_stage.finish_ok("public health passed").await?;

            // === Mark success ===
            mark_deployment_succeeded(
                client, &deployment.deployment_id, &deployment.lease_token,
                stabilized_status.as_u16().into(), &log_path,
            ).await.map_err(TaskExecutionError::db_transition)?;
            let _ = pipeline.emit(TaskEventType::Succeeded, json!({ "status_code": stabilized_status.as_u16() })).await;

            Ok::<(), anyhow::Error>(())
        },
    )
    .await;

    // Clean up sanitized env file
    if tokio_fs::try_exists(&sanitized_env_file).await.unwrap_or(false) {
        let _ = tokio_fs::remove_file(&sanitized_env_file).await;
    }

    // === Rollback on failure ===
    if let Err(error) = deploy_result {
        let rollback_stage = pipeline
            .start_stage(90, TaskStage::Rollback, "restoring previous state")
            .await?;
        let mut failure_error = error;

        match adapter.rollback(&rollback_state, &deploy_params, rollback_stage.debug_path()).await {
            Ok(()) => {
                let label = adapter.runtime_label(&config, &environment.name);
                let _ = pipeline.emit(
                    TaskEventType::RollbackRestored,
                    json!({ "container_name": label.to_string() }),
                ).await;
                rollback_stage.finish_ok(&format!("restored {}", label)).await?;
            }
            Err(rollback_error) => {
                failure_error = failure_error.context(format!("rollback also failed: {:#}", rollback_error));
                rollback_stage.finish_error(&format!("{:#}", failure_error)).await?;
            }
        }

        let failure_message = format!("{:#}", failure_error);
        mark_deployment_failed(
            client, &deployment.deployment_id, &deployment.lease_token,
            &failure_message, None, &log_path,
        ).await.map_err(TaskExecutionError::db_transition)?;
        pipeline.finish_failure(&failure_message).await?;
        let _ = pipeline.emit(TaskEventType::Failed, json!({ "error": failure_message })).await;
        return Err(failure_error);
    }

    // Clean up rollback artifacts on success
    if let Err(cleanup_error) = adapter.discard_rollback(&rollback_state, &log_path).await {
        let _ = append_log(&log_path, &format!("rollback cleanup warning: {}\n", cleanup_error)).await;
    }

    pipeline.finish_success("deployment succeeded").await?;
    Ok(())
}
