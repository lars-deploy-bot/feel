use std::collections::{BTreeMap, HashSet};
use std::env;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Context, Result};
use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use chrono::Utc;
use hostname::get as get_hostname;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use tokio::process::Command;
use tokio::sync::RwLock;
use tokio::time::sleep;
use tokio_postgres::{Client, NoTls};
use tracing::{error, info};
use url::Url;
use uuid::Uuid;

const DATA_DIR: &str = "/var/lib/alive/deployer";
const HEALTH_PORT: u16 = 5095;
const POLL_INTERVAL: Duration = Duration::from_secs(5);
const HEALTH_TIMEOUT: Duration = Duration::from_secs(60);
const STABILIZATION_WINDOW: Duration = Duration::from_secs(75);
const STABILIZATION_POLL_INTERVAL: Duration = Duration::from_secs(5);
const LOCAL_BIND_IP: &str = "127.0.0.1";

#[derive(Clone)]
struct ServiceContext {
    env: ServiceEnv,
    repo_root: PathBuf,
    data_dir: PathBuf,
    hostname: String,
}

#[derive(Clone)]
struct AppState {
    health: Arc<RwLock<HealthState>>,
}

#[derive(Clone, Debug, Serialize)]
struct HealthState {
    status: String,
    last_poll_at: Option<String>,
    current_build_id: Option<String>,
    current_deployment_id: Option<String>,
    last_error: Option<String>,
}

impl Default for HealthState {
    fn default() -> Self {
        Self {
            status: "starting".to_string(),
            last_poll_at: None,
            current_build_id: None,
            current_deployment_id: None,
            last_error: None,
        }
    }
}

#[derive(Clone)]
struct ServiceEnv {
    database_url: String,
    server_config_path: Option<PathBuf>,
}

impl ServiceEnv {
    fn from_env() -> Result<Self> {
        let database_url_raw = env::var("DATABASE_URL").context("DATABASE_URL is required")?;
        let database_password = env::var("DATABASE_PASSWORD").ok();
        let database_url = resolve_database_url(&database_url_raw, database_password)?;
        let server_config_path = env::var("SERVER_CONFIG_PATH").ok().map(PathBuf::from);

        Ok(Self {
            database_url,
            server_config_path,
        })
    }
}

#[derive(Debug, Deserialize, Clone)]
struct AliveConfig {
    schema: u32,
    project: ProjectConfig,
    docker: DockerConfig,
    runtime: RuntimeConfig,
    #[serde(default)]
    build_secrets: Vec<BuildSecret>,
    #[serde(default)]
    policies: PolicyMap,
}

#[derive(Debug, Deserialize, Clone)]
struct ProjectConfig {
    slug: String,
    display_name: String,
    repo_owner: String,
    repo_name: String,
    default_branch: String,
}

#[derive(Debug, Deserialize, Clone)]
struct DockerConfig {
    context: String,
    dockerfile: String,
    target: String,
    image_repository: String,
}

#[derive(Debug, Deserialize, Clone)]
struct RuntimeConfig {
    env_file: String,
    container_port: u16,
    healthcheck_path: String,
    #[serde(default)]
    network_mode: Option<String>,
    #[serde(default)]
    bind_mounts: Vec<BindMount>,
}

#[derive(Debug, Deserialize, Clone)]
struct BuildSecret {
    id: String,
    path: Option<String>,
    env: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
struct BindMount {
    source: Option<String>,
    source_env: Option<String>,
    target: String,
    #[serde(default)]
    read_only: bool,
}

#[derive(Debug, Deserialize, Clone, Default)]
struct PolicyMap {
    staging: Option<EnvironmentPolicy>,
    production: Option<EnvironmentPolicy>,
}

#[derive(Debug, Deserialize, Clone, Default)]
struct EnvironmentPolicy {
    allow_email: bool,
    #[serde(default)]
    blocked_env_keys: Vec<String>,
    #[serde(default)]
    forced_env: BTreeMap<String, String>,
}

#[derive(Debug)]
struct ClaimedBuild {
    build_id: String,
    application_id: String,
    git_ref: String,
}

#[derive(Debug)]
struct ClaimedDeployment {
    deployment_id: String,
    environment_id: String,
    release_id: String,
}

#[derive(Debug)]
struct ApplicationRow {
    slug: String,
    config_path: String,
}

#[derive(Debug)]
struct EnvironmentRow {
    environment_id: String,
    application_id: String,
    name: String,
    hostname: String,
    port: i32,
    healthcheck_path: String,
    allow_email: bool,
}

#[derive(Debug)]
struct ReleaseRow {
    release_id: String,
    application_id: String,
    artifact_ref: String,
    artifact_digest: String,
    alive_toml_snapshot: String,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    ok: bool,
    worker: HealthState,
}

#[tokio::main]
async fn main() -> Result<()> {
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

    info!(message = "alive deployer started", repo_root = %context.repo_root.display());

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

    if let Some(deployment) = claim_next_deployment(client).await? {
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

async fn expire_stale_tasks(client: &Client) -> Result<()> {
    let expired_builds = client
        .execute(
            "
            UPDATE deploy.builds
            SET status = 'failed'::deploy.task_status,
                error_message = CASE
                  WHEN error_message IS NULL OR error_message = '' THEN 'lease expired before completion'
                  ELSE error_message
                END,
                finished_at = now(),
                updated_at = now()
            WHERE status = 'running'::deploy.task_status
              AND lease_expires_at IS NOT NULL
              AND lease_expires_at < now()
            ",
            &[],
        )
        .await
        .context("failed to expire stale builds")?;

    if expired_builds > 0 {
        info!(message = "expired stale builds", count = expired_builds);
    }

    let expired_deployments = client
        .execute(
            "
            UPDATE deploy.deployments
            SET status = 'failed'::deploy.task_status,
                error_message = CASE
                  WHEN error_message IS NULL OR error_message = '' THEN 'lease expired before completion'
                  ELSE error_message
                END,
                finished_at = now(),
                updated_at = now()
            WHERE status = 'running'::deploy.task_status
              AND lease_expires_at IS NOT NULL
              AND lease_expires_at < now()
            ",
            &[],
        )
        .await
        .context("failed to expire stale deployments")?;

    if expired_deployments > 0 {
        info!(
            message = "expired stale deployments",
            count = expired_deployments
        );
    }

    Ok(())
}

async fn claim_next_build(client: &Client, hostname: &str) -> Result<Option<ClaimedBuild>> {
    let lease_token = Uuid::new_v4().to_string();
    let row = client
        .query_opt(
            "
            WITH candidate AS (
              SELECT build_id
              FROM deploy.builds
              WHERE status = 'pending'::deploy.task_status
              ORDER BY created_at ASC
              LIMIT 1
              FOR UPDATE SKIP LOCKED
            )
            UPDATE deploy.builds AS builds
            SET status = 'running'::deploy.task_status,
                started_at = now(),
                attempt_count = builds.attempt_count + 1,
                builder_hostname = $1,
                lease_token = $2,
                lease_expires_at = now() + interval '15 minutes',
                updated_at = now()
            FROM candidate
            WHERE builds.build_id = candidate.build_id
            RETURNING builds.build_id, builds.application_id, builds.git_ref
            ",
            &[&hostname, &lease_token],
        )
        .await
        .context("failed to claim next build")?;

    Ok(row.map(|value| ClaimedBuild {
        build_id: value.get(0),
        application_id: value.get(1),
        git_ref: value.get(2),
    }))
}

async fn claim_next_deployment(client: &Client) -> Result<Option<ClaimedDeployment>> {
    let lease_token = Uuid::new_v4().to_string();
    let row = client
        .query_opt(
            "
            WITH candidate AS (
              SELECT deployment_id
              FROM deploy.deployments
              WHERE status = 'pending'::deploy.task_status
              ORDER BY created_at ASC
              LIMIT 1
              FOR UPDATE SKIP LOCKED
            )
            UPDATE deploy.deployments AS deployments
            SET status = 'running'::deploy.task_status,
                started_at = now(),
                attempt_count = deployments.attempt_count + 1,
                lease_token = $1,
                lease_expires_at = now() + interval '15 minutes',
                updated_at = now()
            FROM candidate
            WHERE deployments.deployment_id = candidate.deployment_id
            RETURNING deployments.deployment_id, deployments.environment_id, deployments.release_id
            ",
            &[&lease_token],
        )
        .await
        .context("failed to claim next deployment")?;

    Ok(row.map(|value| ClaimedDeployment {
        deployment_id: value.get(0),
        environment_id: value.get(1),
        release_id: value.get(2),
    }))
}

async fn process_build(
    client: &Client,
    context: &ServiceContext,
    build: &ClaimedBuild,
) -> Result<()> {
    let log_path = build_log_path(&context.data_dir, &build.build_id);
    prepare_log(&log_path, &format!("build {} started", build.build_id))?;

    let application = fetch_application(client, &build.application_id).await?;
    let resolved_sha = resolve_git_ref(&context.repo_root, &build.git_ref, &log_path).await?;
    let short_sha = resolved_sha.chars().take(12).collect::<String>();
    let commit_message =
        read_git_commit_message(&context.repo_root, &resolved_sha, &log_path).await?;
    let source_dir = context.data_dir.join("sources").join(&build.build_id);
    let archive_path = context
        .data_dir
        .join("archives")
        .join(format!("{}.tar", build.build_id));

    let build_result = async {
        export_git_snapshot(
            &context.repo_root,
            &source_dir,
            &archive_path,
            &resolved_sha,
            &log_path,
        )
        .await?;

        let config_path = source_dir.join(&application.config_path);
        if !config_path.is_file() {
            return Err(anyhow!(
                "git ref {} does not contain required config {}",
                resolved_sha,
                application.config_path
            ));
        }
        let alive_toml_snapshot = fs::read_to_string(&config_path)
            .with_context(|| format!("failed to read {}", config_path.display()))?;
        let alive_config = parse_alive_toml(&alive_toml_snapshot)?;

        validate_application_matches_config(&application, &alive_config)?;
        append_log(
            &log_path,
            &format!(
                "building {} from {}/{} (default branch: {})\n",
                alive_config.project.display_name,
                alive_config.project.repo_owner,
                alive_config.project.repo_name,
                alive_config.project.default_branch
            ),
        )?;

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

        run_logged_command(
            command,
            &log_path,
            &format!("docker build {} ({})", build.build_id, image_ref),
        )
        .await?;

        let artifact_digest = fs::read_to_string(&iid_file)
            .with_context(|| format!("failed to read {}", iid_file.display()))?
            .trim()
            .to_string();

        let release_id = record_release(
            client,
            &build.build_id,
            &build.application_id,
            &resolved_sha,
            &commit_message,
            &image_ref,
            &artifact_digest,
            &alive_toml_snapshot,
        )
        .await?;

        mark_build_succeeded(
            client,
            &build.build_id,
            &resolved_sha,
            &commit_message,
            &alive_toml_snapshot,
            &image_ref,
            &artifact_digest,
            &log_path,
        )
        .await?;

        append_log(&log_path, &format!("release recorded: {}\n", release_id))?;

        Ok::<(), anyhow::Error>(())
    }
    .await;

    cleanup_git_snapshot(&source_dir, &archive_path, &log_path).await?;

    if let Err(error) = build_result {
        mark_build_failed(client, &build.build_id, &error.to_string(), &log_path).await?;
        return Err(error);
    }

    Ok(())
}

async fn process_deployment(
    client: &Client,
    context: &ServiceContext,
    deployment: &ClaimedDeployment,
) -> Result<()> {
    let log_path = deployment_log_path(&context.data_dir, &deployment.deployment_id);
    prepare_log(
        &log_path,
        &format!("deployment {} started", deployment.deployment_id),
    )?;

    let environment = fetch_environment(client, &deployment.environment_id).await?;
    let release = fetch_release(client, &deployment.release_id).await?;

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
        return Err(error);
    }

    let config = parse_alive_toml(&release.alive_toml_snapshot)?;
    let policy = policy_for_environment(&config, &environment.name)?;
    let env_file = context.repo_root.join(&config.runtime.env_file);
    let sanitized_env_file = context
        .data_dir
        .join("runtime-env")
        .join(format!("{}.env", deployment.deployment_id));
    let container_name = format!("alive-control-{}", environment.name);
    let host_port = u16::try_from(environment.port).context("environment port is invalid")?;

    let deploy_result = async {
        append_log(
            &log_path,
            &format!(
                "deploying artifact {} to {}:{}\n",
                release.artifact_ref, environment.hostname, environment.port
            ),
        )?;
        write_sanitized_env_file(
            &env_file,
            &sanitized_env_file,
            policy,
            environment.allow_email,
            host_port,
        )?;

        remove_container_if_exists(&container_name, &log_path).await?;

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

        match runtime_network_mode(&config.runtime)? {
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

        run_logged_command(
            command,
            &log_path,
            &format!(
                "docker run {} ({})",
                deployment.deployment_id, container_name
            ),
        )
        .await?;

        let health_path = if environment.healthcheck_path.is_empty() {
            config.runtime.healthcheck_path.as_str()
        } else {
            environment.healthcheck_path.as_str()
        };

        wait_for_health(host_port, health_path, &log_path).await?;
        let stabilized_status =
            wait_for_container_stability(&container_name, host_port, health_path, &log_path)
                .await?;
        mark_deployment_succeeded(
            client,
            &deployment.deployment_id,
            stabilized_status.as_u16().into(),
            &log_path,
        )
        .await?;

        Ok::<(), anyhow::Error>(())
    }
    .await;

    if let Err(error) = deploy_result {
        let _ = append_container_logs(&container_name, &log_path).await;
        let _ = remove_container_if_exists(&container_name, &log_path).await;
        mark_deployment_failed(
            client,
            &deployment.deployment_id,
            &error.to_string(),
            None,
            &log_path,
        )
        .await?;
        return Err(error);
    }

    Ok(())
}

async fn fetch_application(client: &Client, application_id: &str) -> Result<ApplicationRow> {
    let row = client
        .query_one(
            "
            SELECT slug, config_path
            FROM deploy.applications
            WHERE application_id = $1
            ",
            &[&application_id],
        )
        .await
        .with_context(|| format!("failed to fetch application {}", application_id))?;

    Ok(ApplicationRow {
        slug: row.get(0),
        config_path: row.get(1),
    })
}

async fn fetch_environment(client: &Client, environment_id: &str) -> Result<EnvironmentRow> {
    let row = client
        .query_one(
            "
            SELECT environment_id, application_id, name::text, hostname, port, healthcheck_path, allow_email
            FROM deploy.environments
            WHERE environment_id = $1
            ",
            &[&environment_id],
        )
        .await
        .with_context(|| format!("failed to fetch environment {}", environment_id))?;

    Ok(EnvironmentRow {
        environment_id: row.get(0),
        application_id: row.get(1),
        name: row.get(2),
        hostname: row.get(3),
        port: row.get(4),
        healthcheck_path: row.get(5),
        allow_email: row.get(6),
    })
}

async fn fetch_release(client: &Client, release_id: &str) -> Result<ReleaseRow> {
    let row = client
        .query_one(
            "
            SELECT release_id, application_id, artifact_ref, artifact_digest, alive_toml_snapshot
            FROM deploy.releases
            WHERE release_id = $1
            ",
            &[&release_id],
        )
        .await
        .with_context(|| format!("failed to fetch release {}", release_id))?;

    Ok(ReleaseRow {
        release_id: row.get(0),
        application_id: row.get(1),
        artifact_ref: row.get(2),
        artifact_digest: row.get(3),
        alive_toml_snapshot: row.get(4),
    })
}

async fn mark_build_succeeded(
    client: &Client,
    build_id: &str,
    git_sha: &str,
    commit_message: &str,
    alive_toml_snapshot: &str,
    artifact_ref: &str,
    artifact_digest: &str,
    log_path: &Path,
) -> Result<()> {
    client
        .execute(
            "
            UPDATE deploy.builds
            SET status = 'succeeded'::deploy.task_status,
                git_sha = $2,
                commit_message = $3,
                alive_toml_snapshot = $4,
                artifact_ref = $5,
                artifact_digest = $6,
                build_log_path = $7,
                error_message = NULL,
                finished_at = now(),
                updated_at = now()
            WHERE build_id = $1
            ",
            &[
                &build_id,
                &git_sha,
                &commit_message,
                &alive_toml_snapshot,
                &artifact_ref,
                &artifact_digest,
                &path_to_string(log_path),
            ],
        )
        .await
        .with_context(|| format!("failed to mark build {} as succeeded", build_id))?;

    Ok(())
}

async fn mark_build_failed(
    client: &Client,
    build_id: &str,
    error_message: &str,
    log_path: &Path,
) -> Result<()> {
    client
        .execute(
            "
            UPDATE deploy.builds
            SET status = 'failed'::deploy.task_status,
                error_message = $2,
                build_log_path = $3,
                finished_at = now(),
                updated_at = now()
            WHERE build_id = $1
            ",
            &[&build_id, &error_message, &path_to_string(log_path)],
        )
        .await
        .with_context(|| format!("failed to mark build {} as failed", build_id))?;

    Ok(())
}

async fn mark_deployment_succeeded(
    client: &Client,
    deployment_id: &str,
    healthcheck_status: i32,
    log_path: &Path,
) -> Result<()> {
    client
        .execute(
            "
            UPDATE deploy.deployments
            SET status = 'succeeded'::deploy.task_status,
                deployment_log_path = $2,
                healthcheck_status = $3,
                healthcheck_checked_at = now(),
                error_message = NULL,
                finished_at = now(),
                updated_at = now()
            WHERE deployment_id = $1
            ",
            &[
                &deployment_id,
                &path_to_string(log_path),
                &healthcheck_status,
            ],
        )
        .await
        .with_context(|| format!("failed to mark deployment {} as succeeded", deployment_id))?;

    Ok(())
}

async fn mark_deployment_failed(
    client: &Client,
    deployment_id: &str,
    error_message: &str,
    healthcheck_status: Option<i32>,
    log_path: &Path,
) -> Result<()> {
    client
        .execute(
            "
            UPDATE deploy.deployments
            SET status = 'failed'::deploy.task_status,
                deployment_log_path = $2,
                error_message = $3,
                healthcheck_status = $4::integer,
                healthcheck_checked_at = CASE
                  WHEN $4::integer IS NULL THEN healthcheck_checked_at
                  ELSE now()
                END,
                finished_at = now(),
                updated_at = now()
            WHERE deployment_id = $1
            ",
            &[&deployment_id, &path_to_string(log_path), &error_message, &healthcheck_status],
        )
        .await
        .with_context(|| format!("failed to mark deployment {} as failed", deployment_id))?;

    Ok(())
}

async fn record_release(
    client: &Client,
    build_id: &str,
    application_id: &str,
    git_sha: &str,
    commit_message: &str,
    artifact_ref: &str,
    artifact_digest: &str,
    alive_toml_snapshot: &str,
) -> Result<String> {
    let row = client
        .query_one(
            "
            INSERT INTO deploy.releases (
              application_id,
              build_id,
              git_sha,
              commit_message,
              artifact_kind,
              artifact_ref,
              artifact_digest,
              alive_toml_snapshot
            )
            VALUES ($1, $2, $3, $4, 'docker_image'::deploy.artifact_kind, $5, $6, $7)
            ON CONFLICT (application_id, artifact_digest)
            DO UPDATE SET artifact_ref = EXCLUDED.artifact_ref
            RETURNING release_id
            ",
            &[
                &application_id,
                &build_id,
                &git_sha,
                &commit_message,
                &artifact_ref,
                &artifact_digest,
                &alive_toml_snapshot,
            ],
        )
        .await
        .with_context(|| format!("failed to record release for build {}", build_id))?;

    Ok(row.get(0))
}

fn ensure_data_dirs(data_dir: &Path) -> Result<()> {
    for relative in [
        "archives",
        "logs/builds",
        "logs/deployments",
        "iids",
        "runtime-env",
        "sources",
    ] {
        fs::create_dir_all(data_dir.join(relative))
            .with_context(|| format!("failed to create {}", data_dir.join(relative).display()))?;
    }

    Ok(())
}

fn prepare_log(log_path: &Path, header: &str) -> Result<()> {
    if let Some(parent) = log_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }

    fs::write(
        log_path,
        format!("{}\n{}\n\n", Utc::now().to_rfc3339(), header),
    )
    .with_context(|| format!("failed to create log {}", log_path.display()))?;

    Ok(())
}

fn append_log(log_path: &Path, message: &str) -> Result<()> {
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .with_context(|| format!("failed to open log {}", log_path.display()))?;
    file.write_all(message.as_bytes())
        .with_context(|| format!("failed to write log {}", log_path.display()))?;
    Ok(())
}

fn build_log_path(data_dir: &Path, build_id: &str) -> PathBuf {
    data_dir
        .join("logs")
        .join("builds")
        .join(format!("{}.log", build_id))
}

fn deployment_log_path(data_dir: &Path, deployment_id: &str) -> PathBuf {
    data_dir
        .join("logs")
        .join("deployments")
        .join(format!("{}.log", deployment_id))
}

async fn run_logged_command(
    mut command: Command,
    log_path: &Path,
    description: &str,
) -> Result<()> {
    append_log(log_path, &format!("$ {}\n", description))?;

    let stdout = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .with_context(|| format!("failed to open {}", log_path.display()))?;
    let stderr = stdout
        .try_clone()
        .with_context(|| format!("failed to clone {}", log_path.display()))?;

    command.stdout(Stdio::from(stdout));
    command.stderr(Stdio::from(stderr));

    let status = command
        .status()
        .await
        .context("failed to execute child process")?;
    if !status.success() {
        return Err(anyhow!("{} failed with status {}", description, status));
    }

    append_log(log_path, "\n")?;
    Ok(())
}

async fn resolve_git_ref(repo_root: &Path, git_ref: &str, log_path: &Path) -> Result<String> {
    let direct = run_git_capture(repo_root, ["rev-parse", git_ref], log_path).await;
    if let Ok(value) = direct {
        return Ok(value.trim().to_string());
    }

    run_logged_command(
        git_command(repo_root, ["fetch", "origin", git_ref]),
        log_path,
        &format!("git fetch origin {}", git_ref),
    )
    .await?;

    let fetched = run_git_capture(repo_root, ["rev-parse", "FETCH_HEAD"], log_path).await?;
    Ok(fetched.trim().to_string())
}

async fn read_git_commit_message(
    repo_root: &Path,
    git_sha: &str,
    log_path: &Path,
) -> Result<String> {
    let message =
        run_git_capture(repo_root, ["log", "-1", "--format=%B", git_sha], log_path).await?;
    Ok(message.trim().to_string())
}

async fn export_git_snapshot(
    repo_root: &Path,
    source_dir: &Path,
    archive_path: &Path,
    git_sha: &str,
    log_path: &Path,
) -> Result<()> {
    if source_dir.exists() {
        fs::remove_dir_all(source_dir)
            .with_context(|| format!("failed to remove {}", source_dir.display()))?;
    }
    if archive_path.exists() {
        fs::remove_file(archive_path)
            .with_context(|| format!("failed to remove {}", archive_path.display()))?;
    }
    fs::create_dir_all(source_dir)
        .with_context(|| format!("failed to create {}", source_dir.display()))?;

    run_logged_command(
        git_command(
            repo_root,
            [
                "archive",
                "--format=tar",
                "--output",
                archive_path.to_str().context("invalid archive path")?,
                git_sha,
            ],
        ),
        log_path,
        &format!(
            "git archive --format=tar --output {} {}",
            archive_path.display(),
            git_sha
        ),
    )
    .await?;

    let mut command = Command::new("tar");
    command
        .arg("-xf")
        .arg(archive_path)
        .arg("-C")
        .arg(source_dir);

    run_logged_command(
        command,
        log_path,
        &format!(
            "tar -xf {} -C {}",
            archive_path.display(),
            source_dir.display()
        ),
    )
    .await?;

    if archive_path.exists() {
        fs::remove_file(archive_path)
            .with_context(|| format!("failed to remove {}", archive_path.display()))?;
    }

    Ok(())
}

async fn cleanup_git_snapshot(
    source_dir: &Path,
    archive_path: &Path,
    log_path: &Path,
) -> Result<()> {
    if archive_path.exists() {
        fs::remove_file(archive_path)
            .with_context(|| format!("failed to remove {}", archive_path.display()))?;
    }

    if !source_dir.exists() {
        return Ok(());
    }

    append_log(log_path, &format!("removing {}\n", source_dir.display()))?;
    fs::remove_dir_all(source_dir)
        .with_context(|| format!("failed to remove {}", source_dir.display()))?;

    Ok(())
}

fn git_command<'a, I>(repo_root: &Path, args: I) -> Command
where
    I: IntoIterator<Item = &'a str>,
{
    let mut command = Command::new("git");
    command.arg("-C").arg(repo_root);
    for arg in args {
        command.arg(arg);
    }
    command
}

async fn run_git_capture<'a, I>(repo_root: &Path, args: I, log_path: &Path) -> Result<String>
where
    I: IntoIterator<Item = &'a str>,
{
    let args_vec = args.into_iter().map(str::to_string).collect::<Vec<_>>();
    append_log(
        log_path,
        &format!("$ git -C {} {}\n", repo_root.display(), args_vec.join(" ")),
    )?;

    let output = git_command(repo_root, args_vec.iter().map(String::as_str))
        .output()
        .await
        .context("failed to execute git command")?;

    append_log(log_path, &String::from_utf8_lossy(&output.stdout))?;
    append_log(log_path, &String::from_utf8_lossy(&output.stderr))?;

    if !output.status.success() {
        return Err(anyhow!("git command failed with status {}", output.status));
    }

    Ok(String::from_utf8(output.stdout).context("git output was not valid UTF-8")?)
}

fn parse_alive_toml(content: &str) -> Result<AliveConfig> {
    let config: AliveConfig = toml::from_str(content).context("failed to parse alive.toml")?;
    if config.schema != 1 {
        return Err(anyhow!("unsupported alive.toml schema {}", config.schema));
    }
    Ok(config)
}

fn validate_application_matches_config(
    application: &ApplicationRow,
    config: &AliveConfig,
) -> Result<()> {
    if application.slug != config.project.slug {
        return Err(anyhow!(
            "application slug {} does not match alive.toml slug {}",
            application.slug,
            config.project.slug
        ));
    }

    Ok(())
}

fn resolve_build_secrets(
    repo_root: &Path,
    config: &AliveConfig,
    env_config: &ServiceEnv,
) -> Result<Vec<ResolvedBuildSecret>> {
    let mut secrets = Vec::new();

    for secret in &config.build_secrets {
        let source = if let Some(relative_path) = &secret.path {
            repo_root.join(relative_path)
        } else if let Some(env_name) = &secret.env {
            let value = env::var(env_name)
                .with_context(|| format!("build secret env {} is not set", env_name))?;
            PathBuf::from(value)
        } else if secret.id == "server_config" {
            env_config
                .server_config_path
                .clone()
                .context("SERVER_CONFIG_PATH is required for server_config secret")?
        } else {
            return Err(anyhow!("build secret {} is missing path or env", secret.id));
        };

        if !source.exists() {
            return Err(anyhow!(
                "build secret source {} does not exist",
                source.display()
            ));
        }

        secrets.push(ResolvedBuildSecret {
            id: secret.id.clone(),
            source,
        });
    }

    Ok(secrets)
}

#[derive(Debug)]
struct ResolvedBuildSecret {
    id: String,
    source: PathBuf,
}

fn policy_for_environment<'a>(
    config: &'a AliveConfig,
    environment_name: &str,
) -> Result<&'a EnvironmentPolicy> {
    match environment_name {
        "staging" => config
            .policies
            .staging
            .as_ref()
            .context("missing staging policy in alive.toml"),
        "production" => config
            .policies
            .production
            .as_ref()
            .context("missing production policy in alive.toml"),
        other => Err(anyhow!("unsupported environment {}", other)),
    }
}

fn write_sanitized_env_file(
    source_env_file: &Path,
    output_env_file: &Path,
    policy: &EnvironmentPolicy,
    environment_allow_email: bool,
    port: u16,
) -> Result<()> {
    let content = fs::read_to_string(source_env_file)
        .with_context(|| format!("failed to read {}", source_env_file.display()))?;
    let mut output = String::new();
    let mut written_keys = HashSet::new();
    let block_email = !policy.allow_email || !environment_allow_email;
    let blocked_keys = policy
        .blocked_env_keys
        .iter()
        .map(String::as_str)
        .collect::<HashSet<_>>();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            output.push_str(line);
            output.push('\n');
            continue;
        }

        if let Some((key, _)) = line.split_once('=') {
            let key = key.trim();
            if (block_email && blocked_keys.contains(key))
                || policy.forced_env.contains_key(key)
                || key == "PORT"
            {
                continue;
            }

            written_keys.insert(key.to_string());
        }

        output.push_str(line);
        output.push('\n');
    }

    for (key, value) in &policy.forced_env {
        output.push_str(&format!("{}={}\n", key, value));
        written_keys.insert(key.clone());
    }

    if !written_keys.contains("PORT") {
        output.push_str(&format!("PORT={}\n", port));
    }

    if let Some(parent) = output_env_file.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }

    fs::write(output_env_file, output)
        .with_context(|| format!("failed to write {}", output_env_file.display()))?;

    Ok(())
}

async fn append_container_logs(container_name: &str, log_path: &Path) -> Result<()> {
    let output = Command::new("docker")
        .arg("logs")
        .arg(container_name)
        .output()
        .await
        .context("failed to read docker container logs")?;

    append_log(log_path, &format!("container logs ({})\n", container_name))?;
    if !output.stdout.is_empty() {
        append_log(log_path, &String::from_utf8_lossy(&output.stdout))?;
        if !String::from_utf8_lossy(&output.stdout).ends_with('\n') {
            append_log(log_path, "\n")?;
        }
    }
    if !output.stderr.is_empty() {
        append_log(log_path, &String::from_utf8_lossy(&output.stderr))?;
        if !String::from_utf8_lossy(&output.stderr).ends_with('\n') {
            append_log(log_path, "\n")?;
        }
    }

    Ok(())
}

async fn remove_container_if_exists(container_name: &str, log_path: &Path) -> Result<()> {
    let output = Command::new("docker")
        .arg("container")
        .arg("inspect")
        .arg(container_name)
        .output()
        .await
        .context("failed to inspect docker container")?;

    if !output.status.success() {
        return Ok(());
    }

    run_logged_command(
        {
            let mut command = Command::new("docker");
            command.arg("rm").arg("-f").arg(container_name);
            command
        },
        log_path,
        &format!("docker rm -f {}", container_name),
    )
    .await
}

async fn wait_for_health(port: u16, path: &str, log_path: &Path) -> Result<StatusCode> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .context("failed to build reqwest client")?;
    let health_path = if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{}", path)
    };
    let url = format!("http://{}:{}{}", LOCAL_BIND_IP, port, health_path);
    let started = Instant::now();
    let mut last_status: Option<StatusCode> = None;

    append_log(log_path, &format!("health check: {}\n", url))?;

    while started.elapsed() < HEALTH_TIMEOUT {
        match client.get(&url).send().await {
            Ok(response) => {
                let status = response.status();
                append_log(log_path, &format!("health response: {}\n", status))?;
                last_status = Some(status);
                if status.is_success() {
                    return Ok(status);
                }
            }
            Err(error) => {
                append_log(log_path, &format!("health error: {}\n", error))?;
            }
        }

        sleep(Duration::from_secs(1)).await;
    }

    if let Some(status) = last_status {
        return Err(anyhow!("health check timed out after {:?}", HEALTH_TIMEOUT)
            .context(format!("last status {}", status)));
    }

    Err(anyhow!(
        "health check timed out after {:?} without a response",
        HEALTH_TIMEOUT
    ))
}

async fn wait_for_container_stability(
    container_name: &str,
    port: u16,
    path: &str,
    log_path: &Path,
) -> Result<StatusCode> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .context("failed to build reqwest client")?;
    let health_path = if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{}", path)
    };
    let url = format!("http://{}:{}{}", LOCAL_BIND_IP, port, health_path);
    let started = Instant::now();
    let mut last_status: Option<StatusCode> = None;

    append_log(
        log_path,
        &format!(
            "stabilization window: {:?} for container {} via {}\n",
            STABILIZATION_WINDOW, container_name, url
        ),
    )?;

    while started.elapsed() < STABILIZATION_WINDOW {
        if !container_is_running(container_name).await? {
            return Err(anyhow!(
                "container {} stopped before the stabilization window completed",
                container_name
            ));
        }

        match client.get(&url).send().await {
            Ok(response) => {
                let status = response.status();
                append_log(log_path, &format!("stability health response: {}\n", status))?;
                if !status.is_success() {
                    return Err(anyhow!(
                        "stability health check returned {} for {}",
                        status,
                        container_name
                    ));
                }
                last_status = Some(status);
            }
            Err(error) => {
                append_log(log_path, &format!("stability health error: {}\n", error))?;
                return Err(anyhow!(
                    "stability health check failed for {}: {}",
                    container_name,
                    error
                ));
            }
        }

        sleep(STABILIZATION_POLL_INTERVAL).await;
    }

    last_status.context("stability health check never returned a status")
}

async fn container_is_running(container_name: &str) -> Result<bool> {
    let output = Command::new("docker")
        .arg("container")
        .arg("inspect")
        .arg("--format")
        .arg("{{.State.Running}}")
        .arg(container_name)
        .output()
        .await
        .context("failed to inspect docker container state")?;

    if !output.status.success() {
        return Ok(false);
    }

    let value = String::from_utf8(output.stdout).context("docker inspect output was not UTF-8")?;
    Ok(value.trim() == "true")
}

enum RuntimeNetworkMode {
    Bridge,
    Host,
}

fn runtime_network_mode(runtime: &RuntimeConfig) -> Result<RuntimeNetworkMode> {
    match runtime.network_mode.as_deref() {
        None | Some("bridge") => Ok(RuntimeNetworkMode::Bridge),
        Some("host") => Ok(RuntimeNetworkMode::Host),
        Some(other) => Err(anyhow!("unsupported runtime network mode {}", other)),
    }
}

fn resolve_bind_mount_source(bind_mount: &BindMount, context: &ServiceContext) -> Result<PathBuf> {
    if let Some(source) = &bind_mount.source {
        return Ok(PathBuf::from(source));
    }

    if let Some(source_env) = &bind_mount.source_env {
        if source_env == "SERVER_CONFIG_PATH" {
            if let Some(path) = &context.env.server_config_path {
                return Ok(path.clone());
            }
        }

        return env::var(source_env)
            .map(PathBuf::from)
            .with_context(|| format!("missing bind mount source env {}", source_env));
    }

    Err(anyhow!(
        "bind mount for target {} must set source or source_env",
        bind_mount.target
    ))
}

fn resolve_database_url(database_url: &str, password: Option<String>) -> Result<String> {
    let mut url = Url::parse(database_url).context("DATABASE_URL is invalid")?;
    let has_password = !url.password().unwrap_or_default().is_empty();

    if !has_password {
        if let Some(value) = password {
            url.set_password(Some(&value))
                .map_err(|()| anyhow!("failed to attach DATABASE_PASSWORD to DATABASE_URL"))?;
        }
    }

    Ok(url.to_string())
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}
