use std::time::{Duration, Instant};

use anyhow::{anyhow, Context, Result};
use reqwest::StatusCode;
use tokio::time::sleep;

use crate::constants::{HEALTH_TIMEOUT, LOCAL_BIND_IP, PUBLIC_HEALTH_TIMEOUT};
use crate::logging::append_log;

pub(crate) async fn wait_for_health(
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
