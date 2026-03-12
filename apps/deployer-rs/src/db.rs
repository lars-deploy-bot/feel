use std::path::Path;

use anyhow::{Context, Result};
use thiserror::Error;
use tokio_postgres::Client;
use uuid::Uuid;

use crate::constants::LEASE_DURATION_SECONDS;
use crate::logging::path_to_string;
use crate::types::{
    ApplicationRow, ClaimedBuild, ClaimedDeployment, EnvironmentRow, EnvironmentRuntimeOverrides,
    LeaseTarget, ReleaseRow,
};

#[derive(Debug, Error)]
enum TaskTransitionError {
    #[error("build {build_id} could not transition to succeeded because it was not running")]
    BuildSuccess { build_id: String },
    #[error("build {build_id} could not transition to failed because it was not running")]
    BuildFailure { build_id: String },
    #[error(
        "deployment {deployment_id} could not transition to succeeded because it was not running"
    )]
    DeploymentSuccess { deployment_id: String },
    #[error(
        "deployment {deployment_id} could not transition to failed because it was not running"
    )]
    DeploymentFailure { deployment_id: String },
    #[error("lease renewal skipped because task {task_id} is no longer running")]
    LeaseRenewal { task_id: String },
}

pub(crate) async fn expire_stale_tasks(client: &Client) -> Result<()> {
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
        tracing::info!(message = "expired stale builds", count = expired_builds);
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
        tracing::info!(
            message = "expired stale deployments",
            count = expired_deployments
        );
    }

    Ok(())
}

pub(crate) async fn claim_next_build(
    client: &Client,
    server_id: &str,
    hostname: &str,
) -> Result<Option<ClaimedBuild>> {
    let lease_token = Uuid::new_v4().to_string();
    let row = client
        .query_opt(
            "
            WITH candidate AS (
              SELECT build_id
              FROM deploy.builds
              WHERE status = 'pending'::deploy.task_status
                AND server_id = $1
              ORDER BY created_at ASC
              LIMIT 1
              FOR UPDATE SKIP LOCKED
            )
            UPDATE deploy.builds AS builds
            SET status = 'running'::deploy.task_status,
                started_at = now(),
                attempt_count = builds.attempt_count + 1,
                builder_hostname = $2,
                lease_token = $3,
                lease_expires_at = now() + make_interval(secs => $4::integer),
                updated_at = now()
            FROM candidate
            WHERE builds.build_id = candidate.build_id
            RETURNING
              builds.build_id,
              builds.application_id,
              builds.git_ref,
              COALESCE(builds.git_sha, ''),
              COALESCE(builds.commit_message, ''),
              builds.lease_token
            ",
            &[&server_id, &hostname, &lease_token, &LEASE_DURATION_SECONDS],
        )
        .await
        .context("failed to claim next build")?;

    Ok(row.map(|value| ClaimedBuild {
        build_id: value.get(0),
        application_id: value.get(1),
        git_ref: value.get(2),
        git_sha: value.get(3),
        commit_message: value.get(4),
        lease_token: value.get(5),
    }))
}

pub(crate) async fn claim_next_deployment(
    client: &Client,
    server_id: &str,
) -> Result<Option<ClaimedDeployment>> {
    let lease_token = Uuid::new_v4().to_string();
    let row = client
        .query_opt(
            "
            WITH candidate AS (
              SELECT deployments.deployment_id
              FROM deploy.deployments AS deployments
              INNER JOIN deploy.environments AS environments
                ON environments.environment_id = deployments.environment_id
              WHERE deployments.status = 'pending'::deploy.task_status
                AND environments.server_id = $1
              ORDER BY deployments.created_at ASC
              LIMIT 1
              FOR UPDATE OF deployments SKIP LOCKED
            )
            UPDATE deploy.deployments AS deployments
            SET status = 'running'::deploy.task_status,
                started_at = now(),
                attempt_count = deployments.attempt_count + 1,
                lease_token = $2,
                lease_expires_at = now() + make_interval(secs => $3::integer),
                updated_at = now()
            FROM candidate
            WHERE deployments.deployment_id = candidate.deployment_id
            RETURNING deployments.deployment_id, deployments.environment_id, deployments.release_id, deployments.lease_token
            ",
            &[&server_id, &lease_token, &LEASE_DURATION_SECONDS],
        )
        .await
        .context("failed to claim next deployment")?;

    Ok(row.map(|value| ClaimedDeployment {
        deployment_id: value.get(0),
        environment_id: value.get(1),
        release_id: value.get(2),
        lease_token: value.get(3),
    }))
}

pub(crate) async fn fetch_application(
    client: &Client,
    application_id: &str,
) -> Result<ApplicationRow> {
    let row = client
        .query_one(
            "
            SELECT slug, display_name, repo_owner, repo_name, default_branch, config_path
            FROM deploy.applications
            WHERE application_id = $1
            ",
            &[&application_id],
        )
        .await
        .with_context(|| format!("failed to fetch application {}", application_id))?;

    Ok(ApplicationRow {
        slug: row.get(0),
        display_name: row.get(1),
        repo_owner: row.get(2),
        repo_name: row.get(3),
        default_branch: row.get(4),
        config_path: row.get(5),
    })
}

pub(crate) async fn fetch_environment(
    client: &Client,
    environment_id: &str,
) -> Result<EnvironmentRow> {
    let row = client
        .query_one(
            "
            SELECT environments.environment_id,
                   environments.application_id,
                   environments.server_id,
                   environments.domain_id,
                   domains.org_id,
                   environments.name::text,
                   environments.hostname,
                   environments.port,
                   environments.healthcheck_path,
                   environments.allow_email,
                   environments.runtime_overrides::text
            FROM deploy.environments AS environments
            LEFT JOIN app.domains AS domains
              ON domains.domain_id = environments.domain_id
            WHERE environments.environment_id = $1
            ",
            &[&environment_id],
        )
        .await
        .with_context(|| format!("failed to fetch environment {}", environment_id))?;

    Ok(EnvironmentRow {
        environment_id: row.get(0),
        application_id: row.get(1),
        server_id: row.get(2),
        domain_id: row.get(3),
        org_id: row.get(4),
        name: row.get(5),
        hostname: row.get(6),
        port: row.get(7),
        healthcheck_path: row.get(8),
        allow_email: row.get(9),
        runtime_overrides: serde_json::from_str::<EnvironmentRuntimeOverrides>(
            &row.get::<_, String>(10),
        )
        .context("failed to parse deploy environment runtime overrides")?,
    })
}

pub(crate) async fn fetch_release(client: &Client, release_id: &str) -> Result<ReleaseRow> {
    let row = client
        .query_one(
            "
            SELECT release_id, application_id, git_sha, COALESCE(commit_message, ''), artifact_ref, artifact_digest, alive_toml_snapshot, metadata->>'build_fingerprint'
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
        git_sha: row.get(2),
        commit_message: row.get(3),
        artifact_ref: row.get(4),
        artifact_digest: row.get(5),
        alive_toml_snapshot: row.get(6),
        build_fingerprint: row.get(7),
    })
}

pub(crate) async fn find_reusable_release(
    client: &Client,
    application_id: &str,
    build_fingerprint: &str,
    server_id: &str,
) -> Result<Option<ReleaseRow>> {
    let row = client
        .query_opt(
            "
            SELECT
              releases.release_id,
              releases.application_id,
              releases.git_sha,
              COALESCE(releases.commit_message, ''),
              releases.artifact_ref,
              releases.artifact_digest,
              releases.alive_toml_snapshot,
              releases.metadata->>'build_fingerprint'
            FROM deploy.releases AS releases
            INNER JOIN deploy.builds AS builds
              ON builds.build_id = releases.build_id
            WHERE releases.application_id = $1
              AND releases.metadata->>'build_fingerprint' = $2
              AND builds.server_id = $3
              AND builds.status = 'succeeded'::deploy.task_status
            ORDER BY releases.created_at DESC
            LIMIT 1
            ",
            &[&application_id, &build_fingerprint, &server_id],
        )
        .await
        .with_context(|| {
            format!(
                "failed to look up reusable release for application {} using build fingerprint {} on server {}",
                application_id, build_fingerprint, server_id
            )
        })?;

    Ok(row.map(|row| ReleaseRow {
        release_id: row.get(0),
        application_id: row.get(1),
        git_sha: row.get(2),
        commit_message: row.get(3),
        artifact_ref: row.get(4),
        artifact_digest: row.get(5),
        alive_toml_snapshot: row.get(6),
        build_fingerprint: row.get(7),
    }))
}

pub(crate) async fn mark_build_succeeded(
    client: &Client,
    build_id: &str,
    lease_token: &str,
    git_sha: &str,
    commit_message: &str,
    alive_toml_snapshot: &str,
    artifact_ref: &str,
    artifact_digest: &str,
    log_path: &Path,
) -> Result<()> {
    let updated_rows = client
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
              AND status = 'running'::deploy.task_status
              AND lease_token = $8
            ",
            &[
                &build_id,
                &git_sha,
                &commit_message,
                &alive_toml_snapshot,
                &artifact_ref,
                &artifact_digest,
                &path_to_string(log_path),
                &lease_token,
            ],
        )
        .await
        .with_context(|| format!("failed to mark build {} as succeeded", build_id))?;
    if updated_rows == 0 {
        return Err(TaskTransitionError::BuildSuccess {
            build_id: build_id.to_string(),
        }
        .into());
    }

    Ok(())
}

pub(crate) async fn mark_build_failed(
    client: &Client,
    build_id: &str,
    lease_token: &str,
    error_message: &str,
    log_path: &Path,
) -> Result<()> {
    let updated_rows = client
        .execute(
            "
            UPDATE deploy.builds
            SET status = 'failed'::deploy.task_status,
                error_message = $2,
                build_log_path = $3,
                finished_at = now(),
                updated_at = now()
            WHERE build_id = $1
              AND status = 'running'::deploy.task_status
              AND lease_token = $4
            ",
            &[
                &build_id,
                &error_message,
                &path_to_string(log_path),
                &lease_token,
            ],
        )
        .await
        .with_context(|| format!("failed to mark build {} as failed", build_id))?;
    if updated_rows == 0 {
        return Err(TaskTransitionError::BuildFailure {
            build_id: build_id.to_string(),
        }
        .into());
    }

    Ok(())
}

pub(crate) async fn mark_deployment_succeeded(
    client: &Client,
    deployment_id: &str,
    lease_token: &str,
    healthcheck_status: i32,
    log_path: &Path,
) -> Result<()> {
    let updated_rows = client
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
              AND status = 'running'::deploy.task_status
              AND lease_token = $4
            ",
            &[
                &deployment_id,
                &path_to_string(log_path),
                &healthcheck_status,
                &lease_token,
            ],
        )
        .await
        .with_context(|| format!("failed to mark deployment {} as succeeded", deployment_id))?;
    if updated_rows == 0 {
        return Err(TaskTransitionError::DeploymentSuccess {
            deployment_id: deployment_id.to_string(),
        }
        .into());
    }

    Ok(())
}

pub(crate) async fn mark_deployment_failed(
    client: &Client,
    deployment_id: &str,
    lease_token: &str,
    error_message: &str,
    healthcheck_status: Option<i32>,
    log_path: &Path,
) -> Result<()> {
    let updated_rows = client
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
              AND status = 'running'::deploy.task_status
              AND lease_token = $5
            ",
            &[
                &deployment_id,
                &path_to_string(log_path),
                &error_message,
                &healthcheck_status,
                &lease_token,
            ],
        )
        .await
        .with_context(|| format!("failed to mark deployment {} as failed", deployment_id))?;
    if updated_rows == 0 {
        return Err(TaskTransitionError::DeploymentFailure {
            deployment_id: deployment_id.to_string(),
        }
        .into());
    }

    Ok(())
}

pub(crate) async fn record_release(
    client: &Client,
    build_id: &str,
    application_id: &str,
    git_sha: &str,
    commit_message: &str,
    artifact_ref: &str,
    artifact_digest: &str,
    alive_toml_snapshot: &str,
    build_fingerprint: &str,
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
              alive_toml_snapshot,
              metadata
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              'docker_image'::deploy.artifact_kind,
              $5,
              $6,
              $7,
              jsonb_build_object('build_fingerprint', $8::text)
            )
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
                &build_fingerprint,
            ],
        )
        .await
        .with_context(|| format!("failed to record release for build {}", build_id))?;

    Ok(row.get(0))
}

pub(crate) async fn renew_lease(
    client: &Client,
    target: LeaseTarget,
    task_id: &str,
    lease_token: &str,
) -> Result<()> {
    let query = match target {
        LeaseTarget::Build => {
            "
            UPDATE deploy.builds
            SET lease_expires_at = now() + make_interval(secs => $3::integer),
                updated_at = now()
            WHERE build_id = $1
              AND status = 'running'::deploy.task_status
              AND lease_token = $2
            "
        }
        LeaseTarget::Deployment => {
            "
            UPDATE deploy.deployments
            SET lease_expires_at = now() + make_interval(secs => $3::integer),
                updated_at = now()
            WHERE deployment_id = $1
              AND status = 'running'::deploy.task_status
              AND lease_token = $2
            "
        }
    };
    let renewed_rows = client
        .execute(query, &[&task_id, &lease_token, &LEASE_DURATION_SECONDS])
        .await
        .with_context(|| format!("failed to renew lease for {}", task_id))?;
    if renewed_rows == 0 {
        return Err(TaskTransitionError::LeaseRenewal {
            task_id: task_id.to_string(),
        }
        .into());
    }
    Ok(())
}
