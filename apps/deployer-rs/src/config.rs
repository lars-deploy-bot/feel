use std::collections::HashSet;
use std::env;
use std::fs;
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
        let server_id = load_server_id(&server_config_path)?;

        Ok(Self {
            database_url,
            server_config_path,
            server_id,
        })
    }
}

pub(crate) fn load_server_id(server_config_path: &Path) -> Result<String> {
    let raw = fs::read_to_string(server_config_path)
        .with_context(|| format!("failed to read {}", server_config_path.display()))?;
    parse_server_id_from_server_config(&raw)
}

pub(crate) fn parse_server_id_from_server_config(raw: &str) -> Result<String> {
    let config = serde_json::from_str::<ServerConfigIdentity>(raw)
        .context("failed to parse server-config.json")?;
    if config.server_id.trim().is_empty() {
        return Err(anyhow!("server-config.json is missing serverId"));
    }
    Ok(config.server_id)
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
        output.push_str(&format!("{}={}\n", key, value));
        written_keys.insert(key.clone());
    }

    if !written_keys.contains("PORT") {
        output.push_str(&format!("PORT={}\n", runtime_port));
    }

    if let Some(parent) = output_env_file.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }

    fs::write(output_env_file, output)
        .with_context(|| format!("failed to write {}", output_env_file.display()))?;

    Ok(())
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
        let resolved = PathBuf::from(path);
        if !resolved.exists() {
            return Err(anyhow!(
                "runtime override env file {} does not exist",
                resolved.display()
            ));
        }
        return Ok(resolved);
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
    match runtime.network_mode.as_deref() {
        None | Some("bridge") => Ok(RuntimeNetworkMode::Bridge),
        Some("host") => Ok(RuntimeNetworkMode::Host),
        Some(other) => Err(anyhow!("unsupported runtime network mode {}", other)),
    }
}

pub(crate) fn resolve_bind_mount_source(
    bind_mount: &BindMount,
    context: &ServiceContext,
) -> Result<PathBuf> {
    if let Some(source) = &bind_mount.source {
        return Ok(PathBuf::from(source));
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
        "bind mount for target {} must set source or source_env",
        bind_mount.target
    ))
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
