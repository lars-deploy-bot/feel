mod build;
mod deployment;
mod error;

use std::env;
use std::future::Future;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context, Result};
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::get;
use axum::{Json, Router};
use chrono::Utc;
use hostname::get as get_hostname;
use serde_json::json;
use tokio::sync::RwLock;
use tokio::time::sleep;
use tokio_postgres::{Client, NoTls};
use tokio::signal::unix::{signal, SignalKind};
use tracing::{error, info, warn};

use self::build::process_build;
use self::deployment::{process_deployment, reconcile_running_deployments};
use crate::constants::{DATA_DIR, HEALTH_PORT, LEASE_RENEW_INTERVAL, POLL_INTERVAL};
use crate::db::{claim_next_build, claim_next_deployment, expire_stale_tasks, renew_lease};
use crate::logging::{ensure_data_dirs, read_task_snapshot};
use crate::types::{
    AppState, HealthResponse, HealthState, LeaseTarget, ServiceContext, ServiceEnv, TaskKind,
    WorkerStatus,
};

pub async fn run() -> Result<()> {
    tracing_subscriber::fmt().json().with_target(false).init();

    let service_env = ServiceEnv::from_env()?;
    let repo_root = env::current_dir().context("failed to determine current working directory")?;
    let data_dir = PathBuf::from(DATA_DIR);
    ensure_data_dirs(&data_dir).await?;

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
        data_dir: context.data_dir.clone(),
    };

    let health_server = tokio::spawn(run_health_server(state));

    let mut client = connect_postgres(&context.env.database_url).await?;

    info!(
        message = "alive deployer started",
        repo_root = %context.repo_root.display()
    );

    let mut sigterm =
        signal(SignalKind::terminate()).context("failed to register SIGTERM handler")?;

    let mut health_server = health_server;

    loop {
        if health_server.is_finished() {
            match (&mut health_server).await {
                Ok(Ok(())) => warn!(message = "health server exited unexpectedly"),
                Ok(Err(error)) => error!(message = "health server failed", error = %format!("{:#}", error)),
                Err(error) => error!(message = "health server panicked", error = %error),
            }
            return Err(anyhow::anyhow!("health server is no longer running"));
        }

        {
            let mut worker = health.write().await;
            worker.status = WorkerStatus::Idle;
            worker.last_poll_at = Some(Utc::now().to_rfc3339());
        }

        if client.simple_query("").await.is_err() {
            warn!(message = "postgres connection lost, reconnecting");
            match connect_postgres(&context.env.database_url).await {
                Ok(new_client) => {
                    client = new_client;
                    info!(message = "postgres reconnected successfully");
                }
                Err(reconnect_error) => {
                    error!(message = "postgres reconnect failed", error = %format!("{:#}", reconnect_error));
                    let mut worker = health.write().await;
                    worker.last_error =
                        Some(format!("postgres reconnect failed: {:#}", reconnect_error));
                    worker.status = WorkerStatus::Error;
                    tokio::select! {
                        biased;
                        _ = sigterm.recv() => {
                            info!(message = "received SIGTERM during reconnect backoff");
                            break;
                        }
                        _ = sleep(POLL_INTERVAL) => continue,
                    }
                }
            }
        }

        let tick_result = tick(&client, &context, &health).await;
        if let Err(error) = tick_result {
            error!(message = "worker tick failed", error = %format!("{:#}", error));
            let mut worker = health.write().await;
            worker.last_error = Some(format!("{:#}", error));
            worker.status = WorkerStatus::Error;
            worker.current_build_id = None;
            worker.current_deployment_id = None;
        }

        tokio::select! {
            biased;
            _ = sigterm.recv() => {
                info!(message = "received SIGTERM, shutting down gracefully");
                break;
            }
            _ = sleep(POLL_INTERVAL) => {}
        }
    }

    info!(message = "alive deployer stopped");
    Ok(())
}

async fn connect_postgres(database_url: &str) -> Result<Client> {
    let (client, connection) = tokio_postgres::connect(database_url, NoTls)
        .await
        .context("failed to connect to Postgres")?;

    tokio::spawn(async move {
        if let Err(error) = connection.await {
            error!(message = "postgres connection error", error = %format!("{:#}", error));
        }
    });

    Ok(client)
}

async fn run_health_server(state: AppState) -> Result<()> {
    let router = Router::new()
        .route("/health", get(health_handler))
        .route("/health/details", get(health_details_handler))
        .route("/tasks/{kind}/{id}", get(task_snapshot_handler))
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
    let ok = worker.status != WorkerStatus::Error;
    Json(HealthResponse { ok, worker })
}

async fn health_details_handler(State(state): State<AppState>) -> Json<serde_json::Value> {
    let worker = state.health.read().await.clone();
    let current_build = match worker.current_build_id.as_deref() {
        Some(build_id) => read_task_snapshot(&state.data_dir, TaskKind::Build, build_id)
            .await
            .ok(),
        None => None,
    };
    let current_deployment = match worker.current_deployment_id.as_deref() {
        Some(deployment_id) => {
            read_task_snapshot(&state.data_dir, TaskKind::Deployment, deployment_id)
                .await
                .ok()
        }
        None => None,
    };

    Json(json!({
        "ok": true,
        "worker": worker,
        "current_build": current_build,
        "current_deployment": current_deployment,
    }))
}

async fn task_snapshot_handler(
    State(state): State<AppState>,
    Path((kind, id)): Path<(String, String)>,
) -> std::result::Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let Some(task_kind) = TaskKind::from_route_segment(&kind) else {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({
                "ok": false,
                "error": format!("unsupported task kind {}", kind),
            })),
        ));
    };

    match read_task_snapshot(&state.data_dir, task_kind, &id).await {
        Ok(snapshot) => Ok(Json(json!({ "ok": true, "task": snapshot }))),
        Err(error) => Err((
            StatusCode::NOT_FOUND,
            Json(json!({
                "ok": false,
                "error": error.to_string(),
                "task_kind": kind,
                "task_id": id,
            })),
        )),
    }
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
            worker.status = WorkerStatus::Building;
            worker.current_build_id = Some(build.build_id.clone());
            worker.current_deployment_id = None;
            worker.last_error = None;
        }

        let result = process_build(client, context, &build).await;

        let mut worker = health.write().await;
        worker.current_build_id = None;
        worker.status = if result.is_ok() {
            WorkerStatus::Idle
        } else {
            WorkerStatus::Error
        };
        if let Err(error) = result {
            worker.last_error = Some(format!("{:#}", error));
            return Err(error);
        }

        return Ok(());
    }

    if let Some(deployment) = claim_next_deployment(client, &context.env.server_id).await? {
        {
            let mut worker = health.write().await;
            worker.status = WorkerStatus::Deploying;
            worker.current_build_id = None;
            worker.current_deployment_id = Some(deployment.deployment_id.clone());
            worker.last_error = None;
        }

        let result = process_deployment(client, context, &deployment).await;

        let mut worker = health.write().await;
        worker.current_deployment_id = None;
        worker.status = if result.is_ok() {
            WorkerStatus::Idle
        } else {
            WorkerStatus::Error
        };
        if let Err(error) = result {
            worker.last_error = Some(format!("{:#}", error));
            return Err(error);
        }
    }

    Ok(())
}

pub(super) async fn with_lease_heartbeat<T, F>(
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
