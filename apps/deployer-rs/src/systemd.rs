use std::time::{Duration, Instant};

use anyhow::{anyhow, Context, Result};
use reqwest::StatusCode;
use tokio::process::Command;
use tokio::time::sleep;

use crate::constants::{
    HEALTH_TIMEOUT, LOCAL_BIND_IP, PUBLIC_HEALTH_TIMEOUT, STABILIZATION_POLL_INTERVAL,
    STABILIZATION_WINDOW,
};
use crate::logging::{append_log, run_logged_command};

fn command_stderr(output: &std::process::Output) -> Result<String> {
    String::from_utf8(output.stderr.clone()).context("command stderr was not valid UTF-8")
}

pub(crate) async fn stop_and_disable_systemd_unit(unit: &str, log_path: &std::path::Path) -> Result<()> {
    let is_active = Command::new("systemctl")
        .arg("is-active")
        .arg("--quiet")
        .arg(unit)
        .output()
        .await
        .context("failed to check systemd unit status")?;

    if is_active.status.success() {
        append_log(log_path, &format!("stopping systemd unit {}\n", unit)).await?;

        let stop_output = Command::new("systemctl")
            .arg("stop")
            .arg(unit)
            .output()
            .await
            .context("failed to stop systemd unit")?;

        if !stop_output.status.success() {
            let stderr = command_stderr(&stop_output)?;
            append_log(log_path, &format!("systemctl stop stderr: {}\n", stderr)).await?;
            return Err(anyhow!("failed to stop systemd unit {}: {}", unit, stderr));
        }
    } else if is_active.status.code() == Some(3) {
        append_log(
            log_path,
            &format!("systemd unit {} is not active, skipping stop\n", unit),
        )
        .await?;
    } else {
        let stderr = command_stderr(&is_active)?;
        return Err(anyhow!(
            "failed to determine whether systemd unit {} is active: {}",
            unit,
            stderr.trim()
        ));
    }

    let disable_output = Command::new("systemctl")
        .arg("disable")
        .arg(unit)
        .output()
        .await
        .context("failed to disable systemd unit")?;

    if !disable_output.status.success() {
        let stderr = command_stderr(&disable_output)?;
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

pub(crate) async fn start_and_enable_systemd_unit(unit: &str, log_path: &std::path::Path) -> Result<()> {
    let enable_output = Command::new("systemctl")
        .arg("enable")
        .arg(unit)
        .output()
        .await
        .context("failed to enable systemd unit")?;
    if !enable_output.status.success() {
        let stderr = command_stderr(&enable_output)?;
        append_log(log_path, &format!("systemctl enable stderr: {}\n", stderr)).await?;
        return Err(anyhow!(
            "failed to enable systemd unit {}: {}",
            unit,
            stderr
        ));
    }

    let start_output = Command::new("systemctl")
        .arg("start")
        .arg(unit)
        .output()
        .await
        .context("failed to start systemd unit")?;
    if !start_output.status.success() {
        let stderr = command_stderr(&start_output)?;
        append_log(log_path, &format!("systemctl start stderr: {}\n", stderr)).await?;
        return Err(anyhow!("failed to start systemd unit {}: {}", unit, stderr));
    }

    append_log(
        log_path,
        &format!("systemd unit {} enabled and started\n", unit),
    )
    .await?;
    Ok(())
}

pub(crate) async fn restart_systemd_unit(unit: &str, log_path: &std::path::Path) -> Result<()> {
    append_log(log_path, &format!("restarting systemd unit {}\n", unit)).await?;

    run_logged_command(
        {
            let mut command = Command::new("systemctl");
            command.arg("daemon-reload");
            command
        },
        log_path,
        "systemctl daemon-reload",
    )
    .await?;

    run_logged_command(
        {
            let mut command = Command::new("systemctl");
            command.arg("restart").arg(unit);
            command
        },
        log_path,
        &format!("systemctl restart {}", unit),
    )
    .await?;

    append_log(
        log_path,
        &format!("systemd unit {} restarted\n", unit),
    )
    .await?;
    Ok(())
}

pub(crate) async fn is_systemd_unit_active(unit: &str) -> Result<bool> {
    let output = Command::new("systemctl")
        .arg("is-active")
        .arg("--quiet")
        .arg(unit)
        .output()
        .await
        .context("failed to check systemd unit status")?;
    Ok(output.status.success())
}

pub(crate) async fn capture_unit_logs(unit: &str, lines: u32, log_path: &std::path::Path) -> Result<()> {
    let output = Command::new("journalctl")
        .arg("-u")
        .arg(unit)
        .arg("-n")
        .arg(lines.to_string())
        .arg("--no-pager")
        .output()
        .await
        .context("failed to read journalctl logs")?;

    append_log(log_path, &format!("journalctl -u {} -n {}\n", unit, lines)).await?;
    if !output.stdout.is_empty() {
        append_log(log_path, &String::from_utf8_lossy(&output.stdout)).await?;
        if !String::from_utf8_lossy(&output.stdout).ends_with('\n') {
            append_log(log_path, "\n").await?;
        }
    }

    Ok(())
}

pub(crate) async fn wait_for_health(port: u16, path: &str, log_path: &std::path::Path) -> Result<StatusCode> {
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

pub(crate) async fn wait_for_service_stability(
    unit: &str,
    port: u16,
    path: &str,
    log_path: &std::path::Path,
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
            "stabilization window: {:?} for unit {} via {}\n",
            STABILIZATION_WINDOW, unit, url
        ),
    )
    .await?;

    while started.elapsed() < STABILIZATION_WINDOW {
        if !is_systemd_unit_active(unit).await? {
            return Err(anyhow!(
                "systemd unit {} stopped before the stabilization window completed",
                unit
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
                        unit
                    ));
                }
                last_status = Some(status);
            }
            Err(error) => {
                append_log(log_path, &format!("stability health error: {}\n", error)).await?;
                return Err(anyhow!(
                    "stability health check failed for {}: {}",
                    unit,
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
    log_path: &std::path::Path,
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
