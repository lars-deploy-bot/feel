use std::env;
use std::fs;
use std::future::Future;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{anyhow, Context, Result};
use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use chrono::Utc;
use hostname::get as get_hostname;
use serde_json::json;
use tokio::process::Command;
use tokio::sync::RwLock;
use tokio::time::sleep;
use tokio_postgres::{Client, NoTls};
use tracing::{error, info};

use crate::config::{
    parse_alive_toml, policy_for_environment, resolve_bind_mount_source, resolve_build_secrets,
    resolve_runtime_env_file, runtime_network_mode, validate_application_matches_config,
    write_sanitized_env_file,
};
use crate::constants::{DATA_DIR, HEALTH_PORT, LEASE_RENEW_INTERVAL, LOCAL_BIND_IP, POLL_INTERVAL};
use crate::db::{
    claim_next_build, claim_next_deployment, expire_stale_tasks, fetch_application,
    fetch_environment, fetch_release, mark_build_failed, mark_build_succeeded,
    mark_deployment_failed, mark_deployment_succeeded, record_release, renew_lease,
};
use crate::docker::{
    append_container_logs, container_is_running, deployment_container_name,
    discard_rollback_container, prepare_rollback_container, pull_artifact_digest,
    push_image_and_resolve_artifact_digest, remove_container_if_exists, restore_rollback_container,
    wait_for_container_stability, wait_for_health, wait_for_public_health,
};
use crate::github::{cleanup_source_snapshot, export_github_snapshot, resolve_github_commit};
use crate::logging::{
    append_log, append_task_event, deployment_event_path, deployment_log_path, ensure_data_dirs,
    prepare_log, run_logged_command, TaskPipeline,
};
use crate::types::{
    AppState, ClaimedBuild, ClaimedDeployment, HealthResponse, HealthState, LeaseTarget,
    RuntimeNetworkMode, ServiceContext, ServiceEnv, TaskKind,
};

pub async fn run() -> Result<()> {
    tracing_subscriber::fmt().json().with_target(false).init();

    let service_env = ServiceEnv::from_env()?;
    let repo_root = env::current_dir().context("failed to determine current working directory")?;
    let data_dir = PathBuf::from(DATA_DIR);
    ensure_data_dirs(&data_dir)?;

    let hostname = get_hostname()
        .ok()
        .and_then(|value| value.into_string().ok())
        .unwrap_or_else(|| "unknown-host".to_string());

    let context = ServiceContext {
        env: service_env,
        repo_root,
        data_dir,
        hostname,
    };

    let health = Arc::new(RwLock::new(HealthState::default()));
    let state = AppState {
        health: health.clone(),
    };

    let _health_server = tokio::spawn(run_health_server(state));

    let (client, connection) = tokio_postgres::connect(&context.env.database_url, NoTls)
        .await
        .context("failed to connect to Postgres")?;

    tokio::spawn(async move {
        if let Err(error) = connection.await {
            error!(message = "postgres connection error", error = %format!("{:#}", error));
        }
    });

    info!(
        message = "alive deployer started",
        repo_root = %context.repo_root.display()
    );

    loop {
        {
            let mut worker = health.write().await;
            worker.status = "idle".to_string();
            worker.last_poll_at = Some(Utc::now().to_rfc3339());
        }

        let tick_result = tick(&client, &context, &health).await;
        if let Err(error) = tick_result {
            error!(message = "worker tick failed", error = %format!("{:#}", error));
            let mut worker = health.write().await;
            worker.last_error = Some(format!("{:#}", error));
            worker.status = "error".to_string();
            worker.current_build_id = None;
            worker.current_deployment_id = None;
        }

        sleep(POLL_INTERVAL).await;
    }
}

async fn run_health_server(state: AppState) -> Result<()> {
    let router = Router::new()
        .route("/health", get(health_handler))
        .with_state(state);

    let address = SocketAddr::from(([127, 0, 0, 1], HEALTH_PORT));
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .context("failed to bind health server")?;

    axum::serve(listener, router)
        .await
        .context("health server terminated unexpectedly")?;

    Ok(())
}

async fn health_handler(State(state): State<AppState>) -> Json<HealthResponse> {
    let worker = state.health.read().await.clone();
    Json(HealthResponse { ok: true, worker })
}

async fn tick(
    client: &Client,
    context: &ServiceContext,
    health: &Arc<RwLock<HealthState>>,
) -> Result<()> {
    expire_stale_tasks(client).await?;
    reconcile_running_deployments(client, context).await?;

    if let Some(build) = claim_next_build(client, &context.hostname).await? {
        {
            let mut worker = health.write().await;
            worker.status = "building".to_string();
            worker.current_build_id = Some(build.build_id.clone());
            worker.current_deployment_id = None;
            worker.last_error = None;
        }

        let result = process_build(client, context, &build).await;

        let mut worker = health.write().await;
        worker.current_build_id = None;
        worker.status = if result.is_ok() {
            "idle".to_string()
        } else {
            "error".to_string()
        };
        if let Err(error) = result {
            worker.last_error = Some(error.to_string());
            return Err(error);
        }

        return Ok(());
    }

    if let Some(deployment) = claim_next_deployment(client, &context.env.server_id).await? {
        {
            let mut worker = health.write().await;
            worker.status = "deploying".to_string();
            worker.current_build_id = None;
            worker.current_deployment_id = Some(deployment.deployment_id.clone());
            worker.last_error = None;
        }

        let result = process_deployment(client, context, &deployment).await;

        let mut worker = health.write().await;
        worker.current_deployment_id = None;
        worker.status = if result.is_ok() {
            "idle".to_string()
        } else {
            "error".to_string()
        };
        if let Err(error) = result {
            worker.last_error = Some(error.to_string());
            return Err(error);
        }
    }

    Ok(())
}

async fn reconcile_running_deployments(client: &Client, context: &ServiceContext) -> Result<()> {
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
        .await
        .context("failed to query running deployments for reconciliation")?;

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
        if log_path.exists() {
            append_log(
                &log_path,
                &format!(
                    "reconciliation detected missing or stopped container {}\n",
                    container_name
                ),
            )?;
        } else {
            prepare_log(
                &log_path,
                &format!(
                    "reconciliation detected missing or stopped container {}",
                    container_name
                ),
            )?;
        }
        append_task_event(
            &event_path,
            TaskKind::Deployment,
            &deployment.deployment_id,
            "reconciled_missing_container",
            json!({ "container_name": container_name }),
        )?;
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
        .await?;
    }

    Ok(())
}

async fn process_build(
    client: &Client,
    context: &ServiceContext,
    build: &ClaimedBuild,
) -> Result<()> {
    let pipeline = TaskPipeline::for_build(&context.data_dir, &build.build_id);
    let log_path = pipeline.summary_path().to_path_buf();
    pipeline.prepare(&format!("build {} started", build.build_id))?;
    pipeline.emit(
        "started",
        json!({ "application_id": build.application_id, "git_ref": build.git_ref }),
    )?;

    let application = fetch_application(client, &build.application_id).await?;
    let resolve_stage = pipeline.start_stage(1, "resolve_commit", "resolving git ref")?;
    let resolved_commit =
        match resolve_github_commit(&application, &build.git_ref, resolve_stage.debug_path()).await
        {
            Ok(commit) => {
                pipeline.emit(
                    "commit_resolved",
                    json!({
                        "git_sha": commit.sha,
                        "repo_owner": application.repo_owner,
                        "repo_name": application.repo_name,
                        "debug_log_path": resolve_stage.debug_path().display().to_string(),
                    }),
                )?;
                resolve_stage
                    .finish_ok(&format!("resolved {} to {}", build.git_ref, commit.sha))?;
                commit
            }
            Err(error) => {
                resolve_stage.finish_error(&error.to_string())?;
                pipeline.emit("failed", json!({ "error": error.to_string() }))?;
                mark_build_failed(client, &build.build_id, &error.to_string(), &log_path).await?;
                return Err(error);
            }
        };
    let short_sha = resolved_commit.sha.chars().take(12).collect::<String>();
    let source_dir = context.data_dir.join("sources").join(&build.build_id);
    let archive_path = context
        .data_dir
        .join("archives")
        .join(format!("{}.tar.gz", build.build_id));

    let build_result = with_lease_heartbeat(client, LeaseTarget::Build, &build.build_id, async {
        let prepare_source_stage = pipeline.start_stage(
            2,
            "prepare_source",
            "exporting source snapshot and validating config",
        )?;
        if let Err(error) = export_github_snapshot(
            &application,
            &source_dir,
            &archive_path,
            &resolved_commit.sha,
            prepare_source_stage.debug_path(),
        )
        .await
        {
            prepare_source_stage.finish_error(&error.to_string())?;
            return Err(error);
        }

        let config_path = source_dir.join(&application.config_path);
        if !config_path.is_file() {
            let error = anyhow!(
                "git ref {} does not contain required config {}",
                resolved_commit.sha,
                application.config_path
            );
            prepare_source_stage.finish_error(&error.to_string())?;
            return Err(error);
        }
        let alive_toml_snapshot = fs::read_to_string(&config_path)
            .with_context(|| format!("failed to read {}", config_path.display()))?;
        let alive_config = match parse_alive_toml(&alive_toml_snapshot) {
            Ok(config) => config,
            Err(error) => {
                prepare_source_stage.finish_error(&error.to_string())?;
                return Err(error);
            }
        };

        if let Err(error) = validate_application_matches_config(&application, &alive_config) {
            prepare_source_stage.finish_error(&error.to_string())?;
            return Err(error);
        }
        pipeline.append_summary(&format!(
            "building {} from {}/{} (default branch: {})\n",
            application.display_name,
            application.repo_owner,
            application.repo_name,
            application.default_branch
        ))?;
        prepare_source_stage.finish_ok(&format!("validated {}", config_path.display()))?;

        let dockerfile_path = source_dir.join(&alive_config.docker.dockerfile);
        let build_context = source_dir.join(&alive_config.docker.context);
        let image_ref = format!("{}:{}", alive_config.docker.image_repository, short_sha);
        let iid_file = context
            .data_dir
            .join("iids")
            .join(format!("{}.txt", build.build_id));

        if iid_file.exists() {
            fs::remove_file(&iid_file)
                .with_context(|| format!("failed to remove {}", iid_file.display()))?;
        }

        let build_image_stage =
            pipeline.start_stage(3, "build_image", &format!("building {}", image_ref))?;
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

        for secret in resolve_build_secrets(&context.repo_root, &alive_config, &context.env)? {
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
            build_image_stage.finish_error(&error.to_string())?;
            return Err(error);
        }

        let local_image_id = fs::read_to_string(&iid_file)
            .with_context(|| format!("failed to read {}", iid_file.display()))?
            .trim()
            .to_string();
        build_image_stage.append_debug(&format!("built local image id {}\n", local_image_id))?;
        build_image_stage.finish_ok(&format!("image built as {}", image_ref))?;

        let publish_stage = pipeline.start_stage(
            4,
            "publish_artifact",
            "pushing artifact and resolving digest",
        )?;
        let artifact_digest =
            match push_image_and_resolve_artifact_digest(&image_ref, publish_stage.debug_path())
                .await
            {
                Ok(digest) => digest,
                Err(error) => {
                    publish_stage.finish_error(&error.to_string())?;
                    return Err(error);
                }
            };
        pipeline.emit(
            "artifact_pushed",
            json!({
                "artifact_ref": image_ref,
                "artifact_digest": artifact_digest,
                "debug_log_path": publish_stage.debug_path().display().to_string(),
            }),
        )?;
        publish_stage.finish_ok(&format!("published {}", artifact_digest))?;

        let record_release_stage = pipeline.start_stage(
            5,
            "record_release",
            "recording release and marking build success",
        )?;
        let release_id = record_release(
            client,
            &build.build_id,
            &build.application_id,
            &resolved_commit.sha,
            &resolved_commit.commit.message,
            &image_ref,
            &artifact_digest,
            &alive_toml_snapshot,
        )
        .await?;

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
        .await?;

        pipeline.append_summary(&format!("release recorded: {}\n", release_id))?;
        pipeline.emit("succeeded", json!({ "release_id": release_id }))?;
        record_release_stage.finish_ok(&format!("release {}", release_id))?;

        Ok::<(), anyhow::Error>(())
    })
    .await;

    cleanup_source_snapshot(&source_dir, &archive_path, &log_path).await?;

    if let Err(error) = build_result {
        pipeline.finish_failure(&error.to_string())?;
        pipeline.emit("failed", json!({ "error": error.to_string() }))?;
        mark_build_failed(client, &build.build_id, &error.to_string(), &log_path).await?;
        return Err(error);
    }

    pipeline.finish_success("build succeeded")?;
    Ok(())
}

async fn process_deployment(
    client: &Client,
    context: &ServiceContext,
    deployment: &ClaimedDeployment,
) -> Result<()> {
    let pipeline = TaskPipeline::for_deployment(&context.data_dir, &deployment.deployment_id);
    let log_path = pipeline.summary_path().to_path_buf();
    pipeline.prepare(&format!("deployment {} started", deployment.deployment_id))?;
    pipeline.emit(
        "started",
        json!({
            "environment_id": deployment.environment_id,
            "release_id": deployment.release_id
        }),
    )?;

    let environment = fetch_environment(client, &deployment.environment_id).await?;
    let release = fetch_release(client, &deployment.release_id).await?;

    if environment.server_id != context.env.server_id {
        let error = anyhow!(
            "deployment {} targets server {} but this worker is {}",
            deployment.deployment_id,
            environment.server_id,
            context.env.server_id
        );
        mark_deployment_failed(
            client,
            &deployment.deployment_id,
            &error.to_string(),
            None,
            &log_path,
        )
        .await?;
        pipeline.finish_failure(&error.to_string())?;
        pipeline.emit(
            "failed",
            json!({ "error": error.to_string(), "reason": "server_mismatch" }),
        )?;
        return Err(error);
    }

    if environment.application_id != release.application_id {
        let error = anyhow!(
            "release {} does not belong to environment {}",
            release.release_id,
            environment.environment_id
        );
        mark_deployment_failed(
            client,
            &deployment.deployment_id,
            &error.to_string(),
            None,
            &log_path,
        )
        .await?;
        pipeline.finish_failure(&error.to_string())?;
        pipeline.emit(
            "failed",
            json!({ "error": error.to_string(), "reason": "release_mismatch" }),
        )?;
        return Err(error);
    }

    let config = parse_alive_toml(&release.alive_toml_snapshot)?;
    let policy = policy_for_environment(&config, &environment.name)?;
    let env_file = resolve_runtime_env_file(&config, &environment, context)?;
    let sanitized_env_file = context
        .data_dir
        .join("runtime-env")
        .join(format!("{}.env", deployment.deployment_id));
    let container_name = deployment_container_name(&config.project.slug, &environment.name);
    let host_port = u16::try_from(environment.port).context("environment port is invalid")?;
    let network_mode = runtime_network_mode(&config.runtime)?;
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
            pipeline.append_summary(&format!(
                "deploying artifact {} to {}:{}\n",
                release.artifact_ref, environment.hostname, environment.port
            ))?;
            let prepare_runtime_stage =
                pipeline.start_stage(1, "prepare_runtime", "sanitizing runtime environment")?;
            write_sanitized_env_file(
                &env_file,
                &sanitized_env_file,
                policy,
                environment.allow_email,
                runtime_port,
            )?;
            pipeline.emit(
                "runtime_env_prepared",
                json!({
                    "env_file": sanitized_env_file.display().to_string(),
                    "debug_log_path": prepare_runtime_stage.debug_path().display().to_string(),
                }),
            )?;
            prepare_runtime_stage.finish_ok(&format!(
                "runtime env ready at {}",
                sanitized_env_file.display()
            ))?;

            let pull_artifact_stage =
                pipeline.start_stage(2, "pull_artifact", "pulling immutable artifact")?;
            if let Err(error) =
                pull_artifact_digest(&release.artifact_digest, pull_artifact_stage.debug_path())
                    .await
            {
                pull_artifact_stage.finish_error(&error.to_string())?;
                return Err(error);
            }
            pipeline.emit(
                "artifact_pulled",
                json!({
                    "artifact_digest": release.artifact_digest,
                    "debug_log_path": pull_artifact_stage.debug_path().display().to_string(),
                }),
            )?;
            pull_artifact_stage.finish_ok(&format!("pulled {}", release.artifact_digest))?;

            let reserve_rollback_stage = pipeline.start_stage(
                3,
                "reserve_rollback",
                "reserving previous container for rollback",
            )?;
            if config.project.slug == "alive" {
                let legacy_container_name = format!("alive-control-{}", environment.name);
                if legacy_container_name != container_name {
                    remove_container_if_exists(
                        &legacy_container_name,
                        reserve_rollback_stage.debug_path(),
                    )
                    .await?;
                }
            }

            rollback_container = prepare_rollback_container(
                &container_name,
                &deployment.deployment_id,
                reserve_rollback_stage.debug_path(),
            )
            .await?;
            pipeline.emit(
                "rollback_reserved",
                json!({
                    "container_name": container_name,
                    "debug_log_path": reserve_rollback_stage.debug_path().display().to_string(),
                }),
            )?;
            reserve_rollback_stage.finish_ok(if rollback_container.is_some() {
                "reserved previous container"
            } else {
                "no previous container to reserve"
            })?;

            let start_container_stage =
                pipeline.start_stage(4, "start_container", "starting container")?;
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

            for bind_mount in &config.runtime.bind_mounts {
                let source = resolve_bind_mount_source(bind_mount, context)?;
                let mount_spec = if bind_mount.read_only {
                    format!("{}:{}:ro", source.display(), bind_mount.target)
                } else {
                    format!("{}:{}", source.display(), bind_mount.target)
                };
                command.arg("--volume").arg(mount_spec);
            }

            command.arg(&release.artifact_digest);

            if let Err(error) = run_logged_command(
                command,
                start_container_stage.debug_path(),
                &format!(
                    "docker run {} ({})",
                    deployment.deployment_id, container_name
                ),
            )
            .await
            {
                start_container_stage.finish_error(&error.to_string())?;
                return Err(error);
            }
            pipeline.emit(
                "container_started",
                json!({
                    "container_name": container_name,
                    "debug_log_path": start_container_stage.debug_path().display().to_string(),
                }),
            )?;
            start_container_stage.finish_ok(&format!("container {}", container_name))?;

            let health_path = if environment.healthcheck_path.is_empty() {
                config.runtime.healthcheck_path.as_str()
            } else {
                environment.healthcheck_path.as_str()
            };

            let local_health_stage =
                pipeline.start_stage(5, "local_health", "waiting for localhost health")?;
            if let Err(error) =
                wait_for_health(host_port, health_path, local_health_stage.debug_path()).await
            {
                local_health_stage.finish_error(&error.to_string())?;
                return Err(error);
            }
            pipeline.emit(
                "local_health_passed",
                json!({
                    "port": host_port,
                    "health_path": health_path,
                    "debug_log_path": local_health_stage.debug_path().display().to_string(),
                }),
            )?;
            local_health_stage.finish_ok("local health passed")?;

            let stability_stage =
                pipeline.start_stage(6, "stability", "waiting for stabilization window")?;
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
                    stability_stage.finish_error(&error.to_string())?;
                    return Err(error);
                }
            };
            stability_stage.finish_ok(&format!(
                "stabilized with HTTP {}",
                stabilized_status.as_u16()
            ))?;

            let public_health_stage =
                pipeline.start_stage(7, "public_health", "verifying public route health")?;
            if let Err(error) = wait_for_public_health(
                &environment.hostname,
                health_path,
                public_health_stage.debug_path(),
            )
            .await
            {
                public_health_stage.finish_error(&error.to_string())?;
                return Err(error);
            }
            pipeline.emit(
                "public_health_passed",
                json!({
                    "hostname": environment.hostname,
                    "health_path": health_path,
                    "debug_log_path": public_health_stage.debug_path().display().to_string(),
                }),
            )?;
            public_health_stage.finish_ok("public health passed")?;
            mark_deployment_succeeded(
                client,
                &deployment.deployment_id,
                stabilized_status.as_u16().into(),
                &log_path,
            )
            .await?;
            pipeline.emit(
                "succeeded",
                json!({ "status_code": stabilized_status.as_u16() }),
            )?;

            Ok::<(), anyhow::Error>(())
        },
    )
    .await;

    if let Err(error) = deploy_result {
        let rollback_stage = pipeline.start_stage(
            90,
            "rollback",
            "capturing failure details and restoring previous container",
        )?;
        let _ = append_container_logs(&container_name, rollback_stage.debug_path()).await;
        let _ = remove_container_if_exists(&container_name, rollback_stage.debug_path()).await;
        let mut failure_message = error.to_string();
        if let Some(previous_container) = rollback_container.as_ref() {
            if let Err(restore_error) =
                restore_rollback_container(previous_container, rollback_stage.debug_path()).await
            {
                failure_message = format!(
                    "{}; rollback restore failed: {}",
                    failure_message, restore_error
                );
                rollback_stage.finish_error(&failure_message)?;
            } else {
                pipeline.emit(
                    "rollback_restored",
                    json!({ "container_name": previous_container.original_name }),
                )?;
                rollback_stage
                    .finish_ok(&format!("restored {}", previous_container.original_name))?;
            }
        } else {
            rollback_stage
                .finish_ok("cleaned failed deployment; no previous container to restore")?;
        }
        mark_deployment_failed(
            client,
            &deployment.deployment_id,
            &failure_message,
            None,
            &log_path,
        )
        .await?;
        pipeline.finish_failure(&failure_message)?;
        pipeline.emit("failed", json!({ "error": failure_message }))?;
        return Err(anyhow!(failure_message));
    }

    if let Some(previous_container) = rollback_container.as_ref() {
        if let Err(cleanup_error) = discard_rollback_container(previous_container, &log_path).await
        {
            append_log(
                &log_path,
                &format!("rollback container cleanup warning: {}\n", cleanup_error),
            )?;
        }
    }

    pipeline.finish_success("deployment succeeded")?;
    Ok(())
}

async fn with_lease_heartbeat<T, F>(
    client: &Client,
    target: LeaseTarget,
    task_id: &str,
    future: F,
) -> Result<T>
where
    F: Future<Output = Result<T>>,
{
    tokio::pin!(future);
    loop {
        tokio::select! {
            result = &mut future => return result,
            _ = sleep(LEASE_RENEW_INTERVAL) => {
                renew_lease(client, target, task_id).await?;
            }
        }
    }
}
