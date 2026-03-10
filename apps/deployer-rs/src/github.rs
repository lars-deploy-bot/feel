use std::path::Path;
use std::process::Stdio;

use anyhow::{anyhow, Context, Result};
use tokio::fs as tokio_fs;
use tokio::process::Command;

use crate::constants::GITHUB_API_PREFIX;
use crate::logging::{append_log, run_logged_command};
use crate::types::{ApplicationRow, GitHubCommitPayload};

pub(crate) async fn resolve_github_commit(
    application: &ApplicationRow,
    git_ref: &str,
    log_path: &Path,
) -> Result<GitHubCommitPayload> {
    let resolved_ref = if git_ref.trim().is_empty() || git_ref == "HEAD" {
        application.default_branch.as_str()
    } else {
        git_ref
    };
    let endpoint = format!(
        "{}/{}/{}/commits/{}",
        GITHUB_API_PREFIX, application.repo_owner, application.repo_name, resolved_ref
    );
    let output = run_gh_api_capture(&endpoint, log_path).await?;
    let commit = serde_json::from_str::<GitHubCommitPayload>(&output)
        .context("failed to parse GitHub commit response")?;

    append_log(
        log_path,
        &format!("resolved git ref {} to {}\n", resolved_ref, commit.sha),
    )
    .await?;

    Ok(commit)
}

pub(crate) async fn export_github_snapshot(
    application: &ApplicationRow,
    source_dir: &Path,
    archive_path: &Path,
    git_sha: &str,
    log_path: &Path,
) -> Result<()> {
    if tokio_fs::try_exists(source_dir)
        .await
        .with_context(|| format!("failed to stat {}", source_dir.display()))?
    {
        tokio_fs::remove_dir_all(source_dir)
            .await
            .with_context(|| format!("failed to remove {}", source_dir.display()))?;
    }
    if tokio_fs::try_exists(archive_path)
        .await
        .with_context(|| format!("failed to stat {}", archive_path.display()))?
    {
        tokio_fs::remove_file(archive_path)
            .await
            .with_context(|| format!("failed to remove {}", archive_path.display()))?;
    }
    tokio_fs::create_dir_all(source_dir)
        .await
        .with_context(|| format!("failed to create {}", source_dir.display()))?;

    download_github_tarball(application, git_sha, archive_path, log_path).await?;

    let mut command = Command::new("tar");
    command
        .arg("-xzf")
        .arg(archive_path)
        .arg("-C")
        .arg(source_dir)
        .arg("--strip-components=1");

    run_logged_command(
        command,
        log_path,
        &format!(
            "tar -xzf {} -C {} --strip-components=1",
            archive_path.display(),
            source_dir.display()
        ),
    )
    .await?;

    if tokio_fs::try_exists(archive_path)
        .await
        .with_context(|| format!("failed to stat {}", archive_path.display()))?
    {
        tokio_fs::remove_file(archive_path)
            .await
            .with_context(|| format!("failed to remove {}", archive_path.display()))?;
    }

    Ok(())
}

pub(crate) async fn cleanup_source_snapshot(
    source_dir: &Path,
    archive_path: &Path,
    log_path: &Path,
) -> Result<()> {
    if tokio_fs::try_exists(archive_path)
        .await
        .with_context(|| format!("failed to stat {}", archive_path.display()))?
    {
        tokio_fs::remove_file(archive_path)
            .await
            .with_context(|| format!("failed to remove {}", archive_path.display()))?;
    }

    if !tokio_fs::try_exists(source_dir)
        .await
        .with_context(|| format!("failed to stat {}", source_dir.display()))?
    {
        return Ok(());
    }

    append_log(log_path, &format!("removing {}\n", source_dir.display())).await?;
    tokio_fs::remove_dir_all(source_dir)
        .await
        .with_context(|| format!("failed to remove {}", source_dir.display()))?;

    Ok(())
}

pub(crate) async fn run_gh_api_capture(endpoint: &str, log_path: &Path) -> Result<String> {
    append_log(log_path, &format!("$ gh api {}\n", endpoint)).await?;

    let output = Command::new("gh")
        .arg("api")
        .arg(endpoint)
        .output()
        .await
        .context("failed to execute gh api command")?;

    append_log(log_path, &String::from_utf8_lossy(&output.stderr)).await?;

    if !output.status.success() {
        return Err(anyhow!(
            "gh api command failed with status {}",
            output.status
        ));
    }

    Ok(String::from_utf8(output.stdout).context("gh output was not valid UTF-8")?)
}

pub(crate) async fn download_github_tarball(
    application: &ApplicationRow,
    git_sha: &str,
    archive_path: &Path,
    log_path: &Path,
) -> Result<()> {
    append_log(
        log_path,
        &format!(
            "$ gh api repos/{}/{}/tarball/{} > {}\n",
            application.repo_owner,
            application.repo_name,
            git_sha,
            archive_path.display()
        ),
    )
    .await?;

    let archive_file = tokio_fs::File::create(archive_path)
        .await
        .with_context(|| format!("failed to create {}", archive_path.display()))?;
    let log_file = tokio_fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .await
        .with_context(|| format!("failed to open {}", log_path.display()))?;
    let status = Command::new("gh")
        .arg("api")
        .arg(format!(
            "{}/{}/{}/tarball/{}",
            GITHUB_API_PREFIX, application.repo_owner, application.repo_name, git_sha
        ))
        .stdout(Stdio::from(archive_file.into_std().await))
        .stderr(Stdio::from(log_file.into_std().await))
        .status()
        .await
        .context("failed to execute gh api tarball download")?;

    if !status.success() {
        return Err(anyhow!(
            "gh api tarball download failed with status {}",
            status
        ));
    }

    Ok(())
}
