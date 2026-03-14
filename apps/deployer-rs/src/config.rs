use std::collections::HashSet;
use std::env;
use std::fs;
use std::io::Write;
#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};
use tokio::task::spawn_blocking;
use url::Url;

use crate::types::{
    AliveConfig, ApplicationRow, BindMount, EnvironmentPolicy, EnvironmentRow, ResolvedBuildSecret,
    RuntimeNetworkMode, ServerConfigIdentity, ServiceContext, ServiceEnv,
};

impl ServiceEnv {
    pub(crate) fn from_env() -> Result<Self> {
        let database_url_raw = env::var("DATABASE_URL").context("DATABASE_URL is required")?;
        let database_password = env::var("DATABASE_PASSWORD").ok();
        let database_url = resolve_database_url(&database_url_raw, database_password)?;
        let server_config_path = env::var("SERVER_CONFIG_PATH")
            .map(PathBuf::from)
            .context("SERVER_CONFIG_PATH is required")?;
        let (server_id, alive_root, sites_root) = load_server_identity(&server_config_path)?;

        Ok(Self {
            database_url,
            server_config_path,
            server_id,
            alive_root,
            sites_root,
        })
    }
}

pub(crate) fn load_server_identity(
    server_config_path: &Path,
) -> Result<(String, PathBuf, Option<PathBuf>)> {
    let raw = fs::read_to_string(server_config_path)
        .with_context(|| format!("failed to read {}", server_config_path.display()))?;
    parse_server_identity_from_server_config(&raw)
}

pub(crate) fn parse_server_identity_from_server_config(
    raw: &str,
) -> Result<(String, PathBuf, Option<PathBuf>)> {
    let config = serde_json::from_str::<ServerConfigIdentity>(raw)
        .context("failed to parse server-config.json")?;
    if config.server_id.trim().is_empty() {
        return Err(anyhow!("server-config.json is missing serverId"));
    }
    if config.paths.alive_root.trim().is_empty() {
        return Err(anyhow!("server-config.json is missing paths.aliveRoot"));
    }
    let sites_root = config
        .paths
        .sites_root
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from);
    Ok((
        config.server_id,
        PathBuf::from(config.paths.alive_root),
        sites_root,
    ))
}

pub(crate) fn parse_alive_toml(content: &str) -> Result<AliveConfig> {
    let config: AliveConfig = toml::from_str(content).context("failed to parse alive.toml")?;
    if config.schema != 1 {
        return Err(anyhow!("unsupported alive.toml schema {}", config.schema));
    }
    Ok(config)
}

pub(crate) fn validate_application_matches_config(
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

    if application.display_name != config.project.display_name {
        return Err(anyhow!(
            "application display name {} does not match alive.toml display name {}",
            application.display_name,
            config.project.display_name
        ));
    }

    if application.repo_owner != config.project.repo_owner
        || application.repo_name != config.project.repo_name
    {
        return Err(anyhow!(
            "application repo {}/{} does not match alive.toml repo {}/{}",
            application.repo_owner,
            application.repo_name,
            config.project.repo_owner,
            config.project.repo_name
        ));
    }

    if application.default_branch != config.project.default_branch {
        return Err(anyhow!(
            "application default branch {} does not match alive.toml default branch {}",
            application.default_branch,
            config.project.default_branch
        ));
    }

    Ok(())
}

pub(crate) fn resolve_build_secrets(
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
            env_config.server_config_path.clone()
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

pub(crate) fn policy_for_environment<'a>(
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

pub(crate) fn validate_runtime_policy(
    environment_name: &str,
    policy: &EnvironmentPolicy,
) -> Result<()> {
    match environment_name {
        "staging" | "production" => match policy.forced_env.get("NODE_ENV").map(String::as_str) {
            Some("production") => Ok(()),
            Some(value) => Err(anyhow!(
                "{} policy must force NODE_ENV=production, got {}",
                environment_name,
                value
            )),
            None => Err(anyhow!(
                "{} policy must force NODE_ENV=production",
                environment_name
            )),
        },
        other => Err(anyhow!("unsupported environment {}", other)),
    }
}

pub(crate) fn write_sanitized_env_file(
    source_env_file: &Path,
    output_env_file: &Path,
    policy: &EnvironmentPolicy,
    environment_allow_email: bool,
    runtime_port: u16,
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
            let value = line
                .split_once('=')
                .map(|(_, raw_value)| normalize_env_value(raw_value))
                .context("failed to parse environment line")?;
            output.push_str(&format!("{}={}\n", key, value));
            continue;
        }

        output.push_str(line);
        output.push('\n');
    }

    for (key, value) in &policy.forced_env {
        if key == "PORT" {
            continue;
        }
        output.push_str(&format!("{}={}\n", key, value));
        written_keys.insert(key.clone());
    }

    output.push_str(&format!("PORT={}\n", runtime_port));

    if let Some(parent) = output_env_file.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }

    write_sensitive_file(output_env_file, output.as_bytes())?;

    Ok(())
}

fn write_sensitive_file(path: &Path, contents: &[u8]) -> Result<()> {
    #[cfg(unix)]
    {
        let mut file = fs::OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .mode(0o600)
            .open(path)
            .with_context(|| format!("failed to open {}", path.display()))?;
        file.write_all(contents)
            .with_context(|| format!("failed to write {}", path.display()))?;
        return Ok(());
    }

    #[cfg(not(unix))]
    {
        fs::write(path, contents).with_context(|| format!("failed to write {}", path.display()))?;
        Ok(())
    }
}

pub(crate) async fn write_sanitized_env_file_async(
    source_env_file: &Path,
    output_env_file: &Path,
    policy: EnvironmentPolicy,
    environment_allow_email: bool,
    runtime_port: u16,
) -> Result<()> {
    let source_env_file = source_env_file.to_path_buf();
    let output_env_file = output_env_file.to_path_buf();
    spawn_blocking(move || {
        write_sanitized_env_file(
            &source_env_file,
            &output_env_file,
            &policy,
            environment_allow_email,
            runtime_port,
        )
    })
    .await
    .context("write sanitized env file join failed")?
}

pub(crate) fn normalize_env_value(raw_value: &str) -> String {
    let trimmed = raw_value.trim();
    if trimmed.len() >= 2 {
        let first = trimmed.as_bytes()[0];
        let last = trimmed.as_bytes()[trimmed.len() - 1];
        let matching_quotes = (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'');
        if matching_quotes {
            return trimmed[1..trimmed.len() - 1].to_string();
        }
    }

    trimmed.to_string()
}

pub(crate) fn resolve_runtime_env_file(
    config: &AliveConfig,
    environment: &EnvironmentRow,
    context: &ServiceContext,
) -> Result<PathBuf> {
    if let Some(path) = &environment.runtime_overrides.env_file_path {
        return resolve_runtime_override_env_file(&PathBuf::from(path), &context.env.alive_root);
    }

    let configured = PathBuf::from(&config.runtime.env_file);
    let resolved = if configured.is_absolute() {
        configured
    } else {
        context.repo_root.join(configured)
    };

    if !resolved.exists() {
        return Err(anyhow!(
            "runtime env file {} does not exist",
            resolved.display()
        ));
    }

    Ok(resolved)
}

fn resolve_runtime_override_env_file(configured: &Path, alive_root: &Path) -> Result<PathBuf> {
    if !configured.is_absolute() {
        let resolved = alive_root.join(configured);
        if resolved.exists() {
            return Ok(resolved);
        }

        return Err(anyhow!(
            "runtime override env file {} does not exist when resolved against aliveRoot {}",
            configured.display(),
            alive_root.display()
        ));
    }

    if configured.exists() {
        return Ok(configured.to_path_buf());
    }

    if configured.is_absolute() {
        if let Some(rebased) = rebase_repo_path_to_alive_root(configured, alive_root) {
            if rebased.exists() {
                return Ok(rebased);
            }
        }
    }

    Err(anyhow!(
        "runtime override env file {} does not exist",
        configured.display()
    ))
}

fn rebase_repo_path_to_alive_root(configured: &Path, alive_root: &Path) -> Option<PathBuf> {
    const REPO_ROOT_MARKERS: [&str; 7] = [
        "apps", "packages", "ops", "scripts", "docs", "config", "patches",
    ];

    let components = configured
        .components()
        .map(|component| component.as_os_str().to_string_lossy().into_owned())
        .collect::<Vec<_>>();

    for (index, component) in components.iter().enumerate() {
        if REPO_ROOT_MARKERS.contains(&component.as_str()) {
            let relative = components[index..].join("/");
            return Some(alive_root.join(relative));
        }
    }

    None
}

pub(crate) async fn resolve_runtime_env_file_async(
    config: AliveConfig,
    environment: EnvironmentRow,
    context: ServiceContext,
) -> Result<PathBuf> {
    spawn_blocking(move || resolve_runtime_env_file(&config, &environment, &context))
        .await
        .context("resolve runtime env file join failed")?
}

pub(crate) fn runtime_network_mode(
    runtime: &crate::types::RuntimeConfig,
) -> Result<RuntimeNetworkMode> {
    Ok(runtime.network_mode.unwrap_or(RuntimeNetworkMode::Bridge))
}

pub(crate) fn resolve_bind_mount_source(
    bind_mount: &BindMount,
    context: &ServiceContext,
) -> Result<PathBuf> {
    if let Some(source) = &bind_mount.source {
        return Ok(PathBuf::from(source));
    }

    if let Some(source_server_path) = bind_mount.source_server_path {
        return match source_server_path {
            crate::types::BindMountServerPath::AliveRoot => Ok(context.env.alive_root.clone()),
            crate::types::BindMountServerPath::SitesRoot => context
                .env
                .sites_root
                .clone()
                .ok_or_else(|| anyhow!("server-config.json is missing paths.sitesRoot")),
        };
    }

    if let Some(source_env) = &bind_mount.source_env {
        if source_env == "SERVER_CONFIG_PATH" {
            return Ok(context.env.server_config_path.clone());
        }

        return env::var(source_env)
            .map(PathBuf::from)
            .with_context(|| format!("missing bind mount source env {}", source_env));
    }

    Err(anyhow!(
        "bind mount must set source, source_env, or source_server_path"
    ))
}

pub(crate) fn resolve_bind_mount_target(
    bind_mount: &BindMount,
    context: &ServiceContext,
) -> Result<String> {
    if let Some(target) = &bind_mount.target {
        return Ok(target.clone());
    }

    if let Some(target_server_path) = bind_mount.target_server_path {
        let target = match target_server_path {
            crate::types::BindMountServerPath::AliveRoot => context.env.alive_root.display().to_string(),
            crate::types::BindMountServerPath::SitesRoot => context
                .env
                .sites_root
                .as_ref()
                .ok_or_else(|| anyhow!("server-config.json is missing paths.sitesRoot"))?
                .display()
                .to_string(),
        };
        return Ok(target);
    }

    Err(anyhow!(
        "bind mount must set target or target_server_path"
    ))
}

pub(crate) fn prepare_runtime_bind_mount_source(
    source: &Path,
    bind_mount: &BindMount,
    staged_root: &Path,
) -> Result<PathBuf> {
    let metadata = fs::metadata(source)
        .with_context(|| format!("failed to stat bind mount source {}", source.display()))?;

    if metadata.is_dir() {
        return Ok(source.to_path_buf());
    }

    // Unix sockets, symlinks, and other special files: pass through as-is
    // (e.g. /run/dbus/system_bus_socket for systemctl D-Bus communication)
    if !metadata.is_file() {
        return Ok(source.to_path_buf());
    }

    let target = bind_mount
        .target
        .as_deref()
        .ok_or_else(|| anyhow!("bind mount file source requires an explicit target path"))?;
    let relative_target = target.trim_start_matches('/');
    if relative_target.is_empty() {
        return Err(anyhow!(
            "bind mount target {} must include a file path",
            target
        ));
    }

    let staged_source = staged_root.join(relative_target);
    let parent = staged_source.parent().ok_or_else(|| {
        anyhow!(
            "failed to determine staged parent directory for bind mount target {}",
            target
        )
    })?;
    fs::create_dir_all(parent).with_context(|| format!("failed to create {}", parent.display()))?;
    fs::copy(source, &staged_source).with_context(|| {
        format!(
            "failed to copy bind mount source {} to {}",
            source.display(),
            staged_source.display()
        )
    })?;
    // Preserve the original file's permissions (e.g. executables like /usr/bin/caddy)
    let original_mode = metadata.permissions().mode();
    fs::set_permissions(&staged_source, fs::Permissions::from_mode(original_mode))
        .with_context(|| format!("failed to chmod {}", staged_source.display()))?;

    Ok(staged_source)
}

pub(crate) async fn prepare_runtime_bind_mount_source_async(
    source: &Path,
    bind_mount: BindMount,
    staged_root: &Path,
) -> Result<PathBuf> {
    let source = source.to_path_buf();
    let staged_root = staged_root.to_path_buf();
    spawn_blocking(move || prepare_runtime_bind_mount_source(&source, &bind_mount, &staged_root))
        .await
        .context("prepare runtime bind mount source join failed")?
}

pub(crate) fn resolve_database_url(database_url: &str, password: Option<String>) -> Result<String> {
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
