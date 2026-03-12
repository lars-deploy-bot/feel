use std::path::Path;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Context, Result};
use reqwest::StatusCode;
use tokio::process::Command;
use tokio::time::sleep;

use crate::constants::{
    DOCKER_RETRY_ATTEMPTS, DOCKER_RETRY_BASE_DELAY, HEALTH_TIMEOUT, LOCAL_BIND_IP,
    PUBLIC_HEALTH_TIMEOUT, STABILIZATION_POLL_INTERVAL, STABILIZATION_WINDOW,
};
use crate::logging::{append_log, run_logged_command, run_logged_command_with_retry};
use crate::types::RollbackContainer;

pub(crate) fn docker_reference_repository(reference: &str) -> Result<&str> {
    let last_slash = reference.rfind('/');
    let last_colon = reference.rfind(':');
    match last_colon {
        Some(index) if last_slash.map_or(true, |slash| index > slash) => Ok(&reference[..index]),
        _ => Err(anyhow!(
            "docker image reference {} must include a tag",
            reference
        )),
    }
}

pub(crate) async fn resolve_local_artifact_digest(
    image_ref: &str,
    log_path: &Path,
) -> Result<String> {
    let inspect_output = Command::new("docker")
        .arg("image")
        .arg("inspect")
        .arg("--format")
        .arg("{{.Id}}")
        .arg(image_ref)
        .output()
        .await
        .context("failed to inspect local docker image")?;

    append_log(log_path, &String::from_utf8_lossy(&inspect_output.stderr)).await?;
    if !inspect_output.status.success() {
        return Err(anyhow!(
            "docker image inspect {} failed with status {}",
            image_ref,
            inspect_output.status
        ));
    }

    let image_id = String::from_utf8(inspect_output.stdout)
        .context("docker inspect output was not valid UTF-8")?
        .trim()
        .to_string();

    if image_id.is_empty() {
        return Err(anyhow!(
            "docker image inspect returned empty id for {}",
            image_ref
        ));
    }

    append_log(
        log_path,
        &format!("resolved local artifact digest {}\n", image_id),
    )
    .await?;
    Ok(image_id)
}

pub(crate) async fn stop_and_disable_systemd_unit(unit: &str, log_path: &Path) -> Result<()> {
    let is_active = Command::new("systemctl")
        .arg("is-active")
        .arg("--quiet")
        .arg(unit)
        .status()
        .await
        .context("failed to check systemd unit status")?;

    if !is_active.success() {
        append_log(
            log_path,
            &format!("systemd unit {} is not active, skipping\n", unit),
        )
        .await?;
        return Ok(());
    }

    append_log(log_path, &format!("stopping systemd unit {}\n", unit)).await?;

    let stop_output = Command::new("systemctl")
        .arg("stop")
        .arg(unit)
        .output()
        .await
        .context("failed to stop systemd unit")?;

    if !stop_output.status.success() {
        let stderr = String::from_utf8_lossy(&stop_output.stderr);
        append_log(log_path, &format!("systemctl stop stderr: {}\n", stderr)).await?;
        return Err(anyhow!("failed to stop systemd unit {}: {}", unit, stderr));
    }

    let disable_output = Command::new("systemctl")
        .arg("disable")
        .arg(unit)
        .output()
        .await
        .context("failed to disable systemd unit")?;

    if !disable_output.status.success() {
        let stderr = String::from_utf8_lossy(&disable_output.stderr);
        append_log(log_path, &format!("systemctl disable stderr: {}\n", stderr)).await?;
        // Not fatal — the unit is already stopped
    }

    append_log(
        log_path,
        &format!("systemd unit {} stopped and disabled\n", unit),
    )
    .await?;
    Ok(())
}

pub(crate) async fn image_exists_locally(image_ref: &str) -> Result<bool> {
    let output = Command::new("docker")
        .arg("image")
        .arg("inspect")
        .arg(image_ref)
        .output()
        .await
        .context("failed to inspect docker image")?;
    Ok(output.status.success())
}

pub(crate) fn deployment_container_name(application_slug: &str, environment_name: &str) -> String {
    let normalized_slug = application_slug
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    format!("alive-control-{}-{}", normalized_slug, environment_name)
}

pub(crate) async fn append_container_logs(container_name: &str, log_path: &Path) -> Result<()> {
    let output = Command::new("docker")
        .arg("logs")
        .arg(container_name)
        .output()
        .await
        .context("failed to read docker container logs")?;

    append_log(log_path, &format!("container logs ({})\n", container_name)).await?;
    if !output.stdout.is_empty() {
        append_log(log_path, &String::from_utf8_lossy(&output.stdout)).await?;
        if !String::from_utf8_lossy(&output.stdout).ends_with('\n') {
            append_log(log_path, "\n").await?;
        }
    }
    if !output.stderr.is_empty() {
        append_log(log_path, &String::from_utf8_lossy(&output.stderr)).await?;
        if !String::from_utf8_lossy(&output.stderr).ends_with('\n') {
            append_log(log_path, "\n").await?;
        }
    }

    Ok(())
}

pub(crate) async fn container_exists(container_name: &str) -> Result<bool> {
    let output = Command::new("docker")
        .arg("container")
        .arg("inspect")
        .arg(container_name)
        .output()
        .await
        .context("failed to inspect docker container")?;
    Ok(output.status.success())
}

pub(crate) async fn rename_container(
    current_name: &str,
    next_name: &str,
    log_path: &Path,
) -> Result<()> {
    run_logged_command(
        {
            let mut command = Command::new("docker");
            command.arg("rename").arg(current_name).arg(next_name);
            command
        },
        log_path,
        &format!("docker rename {} {}", current_name, next_name),
    )
    .await
}

pub(crate) async fn stop_container(container_name: &str, log_path: &Path) -> Result<()> {
    run_logged_command(
        {
            let mut command = Command::new("docker");
            command.arg("stop").arg(container_name);
            command
        },
        log_path,
        &format!("docker stop {}", container_name),
    )
    .await
}

pub(crate) async fn start_container(container_name: &str, log_path: &Path) -> Result<()> {
    run_logged_command(
        {
            let mut command = Command::new("docker");
            command.arg("start").arg(container_name);
            command
        },
        log_path,
        &format!("docker start {}", container_name),
    )
    .await
}

pub(crate) async fn prepare_rollback_container(
    container_name: &str,
    deployment_id: &str,
    log_path: &Path,
) -> Result<Option<RollbackContainer>> {
    if !container_exists(container_name).await? {
        return Ok(None);
    }

    let rollback_name = format!("{}-rollback-{}", container_name, deployment_id);
    let rollback_container = RollbackContainer {
        original_name: container_name.to_string(),
        rollback_name,
    };

    rename_container(
        &rollback_container.original_name,
        &rollback_container.rollback_name,
        log_path,
    )
    .await?;

    if let Err(stop_error) = stop_container(&rollback_container.rollback_name, log_path).await {
        let _ = rename_container(
            &rollback_container.rollback_name,
            &rollback_container.original_name,
            log_path,
        )
        .await;
        return Err(stop_error);
    }

    Ok(Some(rollback_container))
}

pub(crate) async fn restore_rollback_container(
    rollback_container: &RollbackContainer,
    log_path: &Path,
) -> Result<()> {
    if !container_exists(&rollback_container.rollback_name).await? {
        return Err(anyhow!(
            "rollback container {} is missing",
            rollback_container.rollback_name
        ));
    }

    if container_exists(&rollback_container.original_name).await? {
        remove_container_if_exists(&rollback_container.original_name, log_path).await?;
    }

    rename_container(
        &rollback_container.rollback_name,
        &rollback_container.original_name,
        log_path,
    )
    .await?;
    start_container(&rollback_container.original_name, log_path).await
}

pub(crate) async fn discard_rollback_container(
    rollback_container: &RollbackContainer,
    log_path: &Path,
) -> Result<()> {
    remove_container_if_exists(&rollback_container.rollback_name, log_path).await
}

pub(crate) async fn remove_container_if_exists(
    container_name: &str,
    log_path: &Path,
) -> Result<()> {
    if !container_exists(container_name).await? {
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

pub(crate) async fn wait_for_health(port: u16, path: &str, log_path: &Path) -> Result<StatusCode> {
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

    append_log(log_path, &format!("health check: {}\n", url)).await?;

    while started.elapsed() < HEALTH_TIMEOUT {
        match client.get(&url).send().await {
            Ok(response) => {
                let status = response.status();
                append_log(log_path, &format!("health response: {}\n", status)).await?;
                last_status = Some(status);
                if status.is_success() {
                    return Ok(status);
                }
            }
            Err(error) => {
                append_log(log_path, &format!("health error: {}\n", error)).await?;
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

pub(crate) async fn wait_for_container_stability(
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
    )
    .await?;

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
                append_log(
                    log_path,
                    &format!("stability health response: {}\n", status),
                )
                .await?;
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
                append_log(log_path, &format!("stability health error: {}\n", error)).await?;
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

pub(crate) async fn wait_for_public_health(
    hostname: &str,
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
    let url = format!("https://{}{}", hostname, health_path);
    let started = Instant::now();
    let mut last_status: Option<StatusCode> = None;

    append_log(log_path, &format!("public health check: {}\n", url)).await?;

    while started.elapsed() < PUBLIC_HEALTH_TIMEOUT {
        match client.get(&url).send().await {
            Ok(response) => {
                let status = response.status();
                append_log(log_path, &format!("public health response: {}\n", status)).await?;
                last_status = Some(status);
                if status.is_success() {
                    return Ok(status);
                }
            }
            Err(error) => {
                append_log(log_path, &format!("public health error: {}\n", error)).await?;
            }
        }

        sleep(Duration::from_secs(1)).await;
    }

    if let Some(status) = last_status {
        return Err(anyhow!(
            "public health check timed out after {:?} for {}",
            PUBLIC_HEALTH_TIMEOUT,
            hostname
        )
        .context(format!("last status {}", status)));
    }

    Err(anyhow!(
        "public health check timed out after {:?} for {} without a response",
        PUBLIC_HEALTH_TIMEOUT,
        hostname
    ))
}

pub(crate) async fn container_is_running(container_name: &str) -> Result<bool> {
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
