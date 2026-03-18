//! # Runtime Adapter
//!
//! The runtime adapter is the boundary between the deployer's orchestration
//! logic and the execution substrate (Docker, systemd, or future runtimes
//! like E2B/Hetzner).
//!
//! ## Contract
//!
//! The deployer calls adapter methods in a strict sequence. Violating the
//! sequence is a bug in the deployer, not the adapter.
//!
//! ### Build sequence
//!
//! ```text
//! 1. artifact_exists_locally()  — check if we can skip the build
//! 2. build_and_publish()        — produce the artifact
//! ```
//!
//! ### Deploy sequence
//!
//! ```text
//! 1. verify_artifact()          — confirm artifact is available
//! 2. prepare_rollback()         → RollbackState (opaque)
//! 3. activate()                 — make the new release live
//! 4. wait_for_local_health()    — HTTP health on localhost
//! 5. wait_for_stability()       — runtime stays up during window
//! 6. wait_for_public_health()   — HTTP health via reverse proxy
//!
//! On success:
//!   7a. discard_rollback(state)
//!
//! On failure (at any step 3-6):
//!   7b. rollback(state)
//! ```
//!
//! ### Reconciliation (periodic)
//!
//! ```text
//! is_running()                  — is the deployed runtime still alive?
//! ```
//!
//! ## Adding a new runtime
//!
//! 1. Create a struct (e.g. `E2bRuntimeAdapter`)
//! 2. Implement `RuntimeLifecycle` for it — the compiler enforces every method
//! 3. Add a variant to `ResolvedRuntimeAdapter`
//! 4. Add a match arm in `ResolvedRuntimeAdapter::from_config`
//! 5. Done. `build.rs` and `deployment.rs` do not change.

use std::path::Path;

use anyhow::{anyhow, Context, Result};
use reqwest::StatusCode;
use sha2::{Digest, Sha256};
use tokio::fs as tokio_fs;
use tokio::process::Command;

use crate::config::{
    prepare_runtime_bind_mount_source_async, resolve_bind_mount_source, resolve_bind_mount_target,
};
use crate::constants::{BUILD_TIMEOUT, LOCAL_BIND_IP};
use crate::docker::{
    container_is_running, deployment_container_name, discard_rollback_container,
    image_exists_locally, prepare_rollback_container, remove_container_if_exists,
    resolve_local_artifact_digest, restore_rollback_container,
};
use crate::health;
use crate::logging::{append_log, run_logged_command_with_timeout, TaskPipeline};
use crate::source_contract::BuildArtifact;
use crate::types::{
    AliveConfig, ArtifactRef, BuildParams, DeployParams, EnvironmentRow,
    RollbackState, RollbackSymlink, RuntimeConfig, RuntimeKindConfig, RuntimeLabel,
    RuntimeNetworkMode,
};
use crate::workspace_contract::{RuntimeKind, RuntimeTarget};

// =============================================================================
// The contract. Every runtime adapter must implement this.
// =============================================================================

/// Full lifecycle of a runtime adapter.
///
/// Each method documents its **preconditions** (what must be true before calling),
/// **postconditions** (what is guaranteed after a successful return), and
/// **error semantics** (what a failure means and whether it is recoverable).
///
/// Implementors: if a method does not apply to your runtime, return `Ok(..)`
/// with the appropriate default. Never panic.
pub(crate) trait RuntimeLifecycle: Send + Sync {
    // ---- Identity ----

    /// Which runtime kind this adapter represents.
    fn kind(&self) -> RuntimeKind;

    /// Resolve the deployment target (server, port, hostname) for an environment.
    fn target_for_environment(&self, environment: &EnvironmentRow) -> Result<RuntimeTarget>;

    /// The port the process listens on inside the runtime.
    ///
    /// - Docker bridge: `container_port` (mapped via `-p host:container`)
    /// - Docker host / systemd: the environment's configured port
    fn runtime_port(
        &self,
        environment: &EnvironmentRow,
        runtime: &RuntimeConfig,
        network_mode: RuntimeNetworkMode,
    ) -> Result<u16>;

    /// A stable, human-readable label for logging and reconciliation.
    ///
    /// - Docker: the container name (e.g. `alive-control-alive-production`)
    /// - Systemd: the unit name (e.g. `alive-production.service`)
    fn runtime_label(&self, config: &AliveConfig, environment_name: &str) -> RuntimeLabel;

    // ---- Build phase ----

    /// Check whether a previously-recorded artifact still exists locally.
    ///
    /// **Precondition:** `artifact_ref` and `artifact_digest` come from a prior
    /// `record_release` row in the database.
    ///
    /// **Postcondition:** Returns `true` if the artifact can be deployed without
    /// rebuilding. Returns `false` if the artifact has been pruned/deleted.
    ///
    /// **Error:** Infrastructure failure (e.g. Docker daemon unreachable).
    fn artifact_exists_locally(
        &self,
        artifact_ref: &str,
        artifact_digest: &str,
    ) -> impl std::future::Future<Output = Result<bool>> + Send;

    /// Execute the build and produce an artifact reference + digest.
    ///
    /// **Precondition:** `params.source_root` contains the checked-out source.
    /// Build secrets are resolved and accessible.
    ///
    /// **Postcondition:** On success, returns an `ArtifactRef` whose
    /// `artifact_ref_str()` and `artifact_digest_str()` can be stored in
    /// `deploy.releases`. The artifact is available locally for immediate
    /// deployment on this server.
    ///
    /// **Error:** Build command failed, outputs missing, digest resolution failed.
    /// The caller marks the build as failed in the database.
    fn build_and_publish(
        &self,
        params: &BuildParams<'_>,
        pipeline: &TaskPipeline,
        build_stage: u8,
        publish_stage: u8,
    ) -> impl std::future::Future<Output = Result<ArtifactRef>> + Send;

    // ---- Deploy phase ----

    /// Confirm that the artifact needed by this release is available locally.
    ///
    /// **Precondition:** A release row exists with `artifact_ref` and `artifact_digest`.
    ///
    /// **Postcondition:** The artifact is ready for activation.
    ///
    /// **Error:** Artifact is missing. Deployment cannot proceed.
    fn verify_artifact(
        &self,
        params: &DeployParams<'_>,
        log_path: &Path,
    ) -> impl std::future::Future<Output = Result<()>> + Send;

    /// Save the current state so the deployer can roll back if activation fails.
    ///
    /// **Precondition:** The environment may or may not have a prior deployment.
    ///
    /// **Postcondition:** Returns an opaque `RollbackState`. The caller MUST
    /// pass this to either `rollback()` (on failure) or `discard_rollback()`
    /// (on success). Dropping it without calling either is a resource leak
    /// (e.g. a renamed Docker container that never gets cleaned up).
    ///
    /// **Error:** Could not save current state. Deployment should not proceed.
    fn prepare_rollback(
        &self,
        params: &DeployParams<'_>,
        log_path: &Path,
    ) -> impl std::future::Future<Output = Result<RollbackState>> + Send;

    /// Make the new release live.
    ///
    /// **Precondition:** `prepare_rollback()` returned successfully.
    /// The sanitized env file is written to `params.sanitized_env_file`.
    ///
    /// **Postcondition:** The new release is running and listening on
    /// `params.host_port`. The previous release is stopped.
    ///
    /// **Error:** Activation failed. The caller MUST call `rollback()`.
    fn activate(
        &self,
        params: &DeployParams<'_>,
        log_path: &Path,
    ) -> impl std::future::Future<Output = Result<()>> + Send;

    /// Wait for the runtime to respond to HTTP health checks on localhost.
    ///
    /// **Precondition:** `activate()` returned successfully.
    ///
    /// **Postcondition:** The health endpoint returned a 2xx status.
    ///
    /// **Error:** Health check timed out. The caller MUST call `rollback()`.
    fn wait_for_local_health(
        &self,
        params: &DeployParams<'_>,
        log_path: &Path,
    ) -> impl std::future::Future<Output = Result<StatusCode>> + Send;

    /// Verify the runtime stays up during a stabilization window.
    ///
    /// Polls both the health endpoint AND the runtime process/container.
    /// If either fails during the window, the deployment is considered unstable.
    ///
    /// **Precondition:** `wait_for_local_health()` passed.
    ///
    /// **Postcondition:** The runtime has been healthy for the full window.
    ///
    /// **Error:** Runtime crashed or health degraded. The caller MUST call `rollback()`.
    fn wait_for_stability(
        &self,
        params: &DeployParams<'_>,
        log_path: &Path,
    ) -> impl std::future::Future<Output = Result<StatusCode>> + Send;

    /// Check health via the public hostname (HTTPS through the reverse proxy).
    ///
    /// This verifies the full request path: browser → Cloudflare → Caddy → runtime.
    ///
    /// **Precondition:** `wait_for_stability()` passed.
    ///
    /// **Postcondition:** The public endpoint returned a 2xx status.
    ///
    /// **Error:** Public health timed out. The caller MUST call `rollback()`.
    fn wait_for_public_health(
        &self,
        params: &DeployParams<'_>,
        log_path: &Path,
    ) -> impl std::future::Future<Output = Result<StatusCode>> + Send;

    /// Undo activation using previously saved rollback state.
    ///
    /// **Precondition:** `prepare_rollback()` returned the given `RollbackState`.
    /// Activation was attempted (may or may not have succeeded).
    ///
    /// **Postcondition:** The previous release is running again, or the runtime
    /// is in the best recoverable state.
    ///
    /// **Error:** Rollback itself failed. The environment is in an unknown state.
    /// The deployer logs the error but cannot recover further.
    fn rollback(
        &self,
        state: &RollbackState,
        params: &DeployParams<'_>,
        log_path: &Path,
    ) -> impl std::future::Future<Output = Result<()>> + Send;

    /// Clean up rollback artifacts after a successful deployment.
    ///
    /// **Precondition:** The deployment succeeded. `RollbackState` is no longer needed.
    ///
    /// **Postcondition:** Rollback artifacts are removed (e.g. old Docker container).
    ///
    /// **Error:** Cleanup failed. This is non-fatal — logged as a warning.
    fn discard_rollback(
        &self,
        state: &RollbackState,
        log_path: &Path,
    ) -> impl std::future::Future<Output = Result<()>> + Send;

    // ---- Reconciliation ----

    /// Check if the deployed runtime is still running.
    ///
    /// Called periodically by the deployer's reconciliation loop.
    /// If this returns `false`, the deployer marks the deployment as failed.
    ///
    /// - Docker: `docker container inspect --format '{{.State.Running}}'`
    /// - Systemd: `systemctl is-active --quiet`
    fn is_running(
        &self,
        config: &AliveConfig,
        environment_name: &str,
    ) -> impl std::future::Future<Output = Result<bool>> + Send;
}

// =============================================================================
// Docker adapter
// =============================================================================

#[derive(Clone, Copy, Debug, Default)]
pub(crate) struct HostRuntimeAdapter;

impl RuntimeLifecycle for HostRuntimeAdapter {
    fn kind(&self) -> RuntimeKind {
        RuntimeKind::Host
    }

    fn target_for_environment(&self, environment: &EnvironmentRow) -> Result<RuntimeTarget> {
        RuntimeTarget::for_environment(self.kind(), environment)
    }

    fn runtime_port(
        &self,
        environment: &EnvironmentRow,
        runtime: &RuntimeConfig,
        network_mode: RuntimeNetworkMode,
    ) -> Result<u16> {
        let host_port = u16::try_from(environment.port)
            .map_err(|e| anyhow!("invalid environment port {}: {}", environment.port, e))?;
        Ok(match network_mode {
            RuntimeNetworkMode::Bridge => runtime.container_port,
            RuntimeNetworkMode::Host => host_port,
        })
    }

    fn runtime_label(&self, config: &AliveConfig, environment_name: &str) -> RuntimeLabel {
        RuntimeLabel(deployment_container_name(
            &config.project.slug,
            environment_name,
        ))
    }

    async fn artifact_exists_locally(
        &self,
        artifact_ref: &str,
        artifact_digest: &str,
    ) -> Result<bool> {
        let digest_ok = image_exists_locally(artifact_digest).await?;
        let ref_ok = image_exists_locally(artifact_ref).await?;
        Ok(digest_ok || ref_ok)
    }

    async fn build_and_publish(
        &self,
        params: &BuildParams<'_>,
        pipeline: &TaskPipeline,
        build_stage: u8,
        publish_stage: u8,
    ) -> Result<ArtifactRef> {
        build_docker(params, pipeline, build_stage, publish_stage).await
    }

    async fn verify_artifact(
        &self,
        params: &DeployParams<'_>,
        log_path: &Path,
    ) -> Result<()> {
        let d = image_exists_locally(&params.release.artifact_digest).await?;
        let r = image_exists_locally(&params.release.artifact_ref).await?;
        if d || r {
            append_log(log_path, &format!(
                "artifact available locally (ref={}, digest={})\n",
                params.release.artifact_ref, params.release.artifact_digest
            )).await?;
            Ok(())
        } else {
            Err(anyhow!(
                "artifact missing locally: ref={} digest={}",
                params.release.artifact_ref, params.release.artifact_digest
            ))
        }
    }

    async fn prepare_rollback(
        &self,
        params: &DeployParams<'_>,
        log_path: &Path,
    ) -> Result<RollbackState> {
        let container_name = deployment_container_name(
            &params.config.project.slug,
            &params.environment.name,
        );
        let rollback = prepare_rollback_container(
            &container_name,
            params.deployment_id,
            log_path,
        ).await?;

        // Stop legacy systemd service (from before Docker migration)
        let legacy_unit = format!("alive-{}.service", params.environment.name);
        crate::systemd::stop_and_disable_systemd_unit(&legacy_unit, log_path).await?;

        Ok(match rollback {
            Some(c) => RollbackState::Container(c),
            None => RollbackState::None,
        })
    }

    async fn activate(
        &self,
        params: &DeployParams<'_>,
        log_path: &Path,
    ) -> Result<()> {
        activate_docker(params, log_path).await
    }

    async fn wait_for_local_health(
        &self,
        params: &DeployParams<'_>,
        log_path: &Path,
    ) -> Result<StatusCode> {
        health::wait_for_health(params.host_port, &resolve_health_path(params), log_path).await
    }

    async fn wait_for_stability(
        &self,
        params: &DeployParams<'_>,
        log_path: &Path,
    ) -> Result<StatusCode> {
        let name = deployment_container_name(&params.config.project.slug, &params.environment.name);
        crate::docker::wait_for_container_stability(
            &name, params.host_port, &resolve_health_path(params), log_path,
        ).await
    }

    async fn wait_for_public_health(
        &self,
        params: &DeployParams<'_>,
        log_path: &Path,
    ) -> Result<StatusCode> {
        health::wait_for_public_health(
            &params.environment.hostname, &resolve_health_path(params), log_path,
        ).await
    }

    async fn rollback(
        &self,
        state: &RollbackState,
        params: &DeployParams<'_>,
        log_path: &Path,
    ) -> Result<()> {
        let name = deployment_container_name(&params.config.project.slug, &params.environment.name);
        let _ = crate::docker::append_container_logs(&name, log_path).await;
        let _ = remove_container_if_exists(&name, log_path).await;

        match state {
            RollbackState::Container(prev) => restore_rollback_container(prev, log_path).await,
            RollbackState::None => {
                let legacy = format!("alive-{}.service", params.environment.name);
                crate::systemd::start_and_enable_systemd_unit(&legacy, log_path).await
            }
            RollbackState::Symlink(_) => {
                Err(anyhow!("Docker adapter received symlink rollback state — this is a deployer bug"))
            }
        }
    }

    async fn discard_rollback(&self, state: &RollbackState, log_path: &Path) -> Result<()> {
        if let RollbackState::Container(c) = state {
            discard_rollback_container(c, log_path).await
        } else {
            Ok(())
        }
    }

    async fn is_running(&self, config: &AliveConfig, environment_name: &str) -> Result<bool> {
        let name = deployment_container_name(&config.project.slug, environment_name);
        container_is_running(&name).await
    }
}

// =============================================================================
// Systemd adapter
// =============================================================================

#[derive(Clone, Copy, Debug, Default)]
pub(crate) struct SystemdRuntimeAdapter;

impl RuntimeLifecycle for SystemdRuntimeAdapter {
    fn kind(&self) -> RuntimeKind {
        RuntimeKind::Systemd
    }

    fn target_for_environment(&self, environment: &EnvironmentRow) -> Result<RuntimeTarget> {
        RuntimeTarget::for_environment(self.kind(), environment)
    }

    fn runtime_port(
        &self,
        environment: &EnvironmentRow,
        _runtime: &RuntimeConfig,
        _network_mode: RuntimeNetworkMode,
    ) -> Result<u16> {
        u16::try_from(environment.port)
            .map_err(|e| anyhow!("invalid environment port {}: {}", environment.port, e))
    }

    fn runtime_label(&self, config: &AliveConfig, environment_name: &str) -> RuntimeLabel {
        RuntimeLabel(resolve_systemd_unit_name(config, environment_name))
    }

    async fn artifact_exists_locally(
        &self,
        artifact_ref: &str,
        _artifact_digest: &str,
    ) -> Result<bool> {
        if let Some(path) = artifact_ref.strip_prefix("dir:") {
            if let Some(colon) = path.rfind(':') {
                return Ok(Path::new(&path[..colon]).exists());
            }
        }
        Ok(false)
    }

    async fn build_and_publish(
        &self,
        params: &BuildParams<'_>,
        pipeline: &TaskPipeline,
        build_stage: u8,
        publish_stage: u8,
    ) -> Result<ArtifactRef> {
        build_systemd(params, pipeline, build_stage, publish_stage).await
    }

    async fn verify_artifact(
        &self,
        params: &DeployParams<'_>,
        _log_path: &Path,
    ) -> Result<()> {
        let systemd = require_systemd_config(params.config)?;
        let path = params.context.repo_root.join(&systemd.release_root);
        if tokio_fs::try_exists(&path).await.unwrap_or(false) {
            Ok(())
        } else {
            Err(anyhow!("release root {} does not exist", path.display()))
        }
    }

    async fn prepare_rollback(
        &self,
        params: &DeployParams<'_>,
        log_path: &Path,
    ) -> Result<RollbackState> {
        // Stop any legacy Docker container that might hold the port
        let legacy_container = deployment_container_name(
            &params.config.project.slug,
            &params.environment.name,
        );
        if container_is_running(&legacy_container).await.unwrap_or(false) {
            append_log(
                log_path,
                &format!("stopping legacy Docker container {} to free port\n", legacy_container),
            ).await?;
            let _ = remove_container_if_exists(&legacy_container, log_path).await;
        }

        let systemd = require_systemd_config(params.config)?;
        let dir = resolve_release_dir(systemd, &params.context.repo_root, &params.environment.name);
        let current = dir.join("current");
        let previous = if tokio_fs::try_exists(&current).await.unwrap_or(false) {
            tokio_fs::read_link(&current).await.ok()
        } else {
            None
        };
        Ok(RollbackState::Symlink(RollbackSymlink {
            symlink_path: current,
            previous_target: previous,
        }))
    }

    async fn activate(
        &self,
        params: &DeployParams<'_>,
        log_path: &Path,
    ) -> Result<()> {
        activate_systemd(params, log_path).await
    }

    async fn wait_for_local_health(
        &self,
        params: &DeployParams<'_>,
        log_path: &Path,
    ) -> Result<StatusCode> {
        health::wait_for_health(params.host_port, &resolve_health_path(params), log_path).await
    }

    async fn wait_for_stability(
        &self,
        params: &DeployParams<'_>,
        log_path: &Path,
    ) -> Result<StatusCode> {
        let unit = resolve_systemd_unit_name(params.config, &params.environment.name);
        crate::systemd::wait_for_service_stability(
            &unit, params.host_port, &resolve_health_path(params), log_path,
        ).await
    }

    async fn wait_for_public_health(
        &self,
        params: &DeployParams<'_>,
        log_path: &Path,
    ) -> Result<StatusCode> {
        health::wait_for_public_health(
            &params.environment.hostname, &resolve_health_path(params), log_path,
        ).await
    }

    async fn rollback(
        &self,
        state: &RollbackState,
        params: &DeployParams<'_>,
        log_path: &Path,
    ) -> Result<()> {
        match state {
            RollbackState::Symlink(s) => {
                if let Some(previous) = &s.previous_target {
                    let temp = s.symlink_path.with_extension("rollback");
                    let _ = tokio_fs::remove_file(&temp).await;
                    tokio_fs::symlink(previous, &temp).await
                        .with_context(|| format!("rollback symlink failed: {} -> {}", temp.display(), previous.display()))?;
                    tokio_fs::rename(&temp, &s.symlink_path).await
                        .with_context(|| "rollback symlink rename failed")?;
                    let unit = resolve_systemd_unit_name(params.config, &params.environment.name);
                    crate::systemd::restart_systemd_unit(&unit, log_path).await
                } else {
                    Ok(())
                }
            }
            RollbackState::None => Ok(()),
            RollbackState::Container(_) => {
                Err(anyhow!("Systemd adapter received container rollback state — this is a deployer bug"))
            }
        }
    }

    async fn discard_rollback(&self, _state: &RollbackState, _log_path: &Path) -> Result<()> {
        Ok(()) // Systemd rollback state (symlink path) needs no cleanup
    }

    async fn is_running(&self, config: &AliveConfig, environment_name: &str) -> Result<bool> {
        let unit = resolve_systemd_unit_name(config, environment_name);
        crate::systemd::is_systemd_unit_active(&unit).await
    }
}

// =============================================================================
// Dispatch enum — the only type callers interact with
// =============================================================================

#[derive(Debug)]
pub(crate) enum ResolvedRuntimeAdapter {
    Host(HostRuntimeAdapter),
    Systemd(SystemdRuntimeAdapter),
}

impl ResolvedRuntimeAdapter {
    pub(crate) fn from_config(kind: RuntimeKindConfig) -> Result<Self> {
        match kind {
            RuntimeKindConfig::Host => Ok(Self::Host(HostRuntimeAdapter)),
            RuntimeKindConfig::Systemd => Ok(Self::Systemd(SystemdRuntimeAdapter)),
            RuntimeKindConfig::E2b => Err(anyhow!("runtime kind e2b is not implemented yet")),
            RuntimeKindConfig::Hetzner => Err(anyhow!("runtime kind hetzner is not implemented yet")),
        }
    }
}

/// Delegate every `RuntimeLifecycle` method through the enum.
///
/// This macro-free approach means the compiler verifies exhaustive matching.
/// If you add a variant to `ResolvedRuntimeAdapter`, every method here will
/// fail to compile until you add the new match arm.
impl RuntimeLifecycle for ResolvedRuntimeAdapter {
    fn kind(&self) -> RuntimeKind {
        match self { Self::Host(a) => a.kind(), Self::Systemd(a) => a.kind() }
    }
    fn target_for_environment(&self, env: &EnvironmentRow) -> Result<RuntimeTarget> {
        match self { Self::Host(a) => a.target_for_environment(env), Self::Systemd(a) => a.target_for_environment(env) }
    }
    fn runtime_port(&self, env: &EnvironmentRow, rt: &RuntimeConfig, nm: RuntimeNetworkMode) -> Result<u16> {
        match self { Self::Host(a) => a.runtime_port(env, rt, nm), Self::Systemd(a) => a.runtime_port(env, rt, nm) }
    }
    fn runtime_label(&self, config: &AliveConfig, env_name: &str) -> RuntimeLabel {
        match self { Self::Host(a) => a.runtime_label(config, env_name), Self::Systemd(a) => a.runtime_label(config, env_name) }
    }
    async fn artifact_exists_locally(&self, r: &str, d: &str) -> Result<bool> {
        match self { Self::Host(a) => a.artifact_exists_locally(r, d).await, Self::Systemd(a) => a.artifact_exists_locally(r, d).await }
    }
    async fn build_and_publish(&self, p: &BuildParams<'_>, pl: &TaskPipeline, bs: u8, ps: u8) -> Result<ArtifactRef> {
        match self { Self::Host(a) => a.build_and_publish(p, pl, bs, ps).await, Self::Systemd(a) => a.build_and_publish(p, pl, bs, ps).await }
    }
    async fn verify_artifact(&self, p: &DeployParams<'_>, lp: &Path) -> Result<()> {
        match self { Self::Host(a) => a.verify_artifact(p, lp).await, Self::Systemd(a) => a.verify_artifact(p, lp).await }
    }
    async fn prepare_rollback(&self, p: &DeployParams<'_>, lp: &Path) -> Result<RollbackState> {
        match self { Self::Host(a) => a.prepare_rollback(p, lp).await, Self::Systemd(a) => a.prepare_rollback(p, lp).await }
    }
    async fn activate(&self, p: &DeployParams<'_>, lp: &Path) -> Result<()> {
        match self { Self::Host(a) => a.activate(p, lp).await, Self::Systemd(a) => a.activate(p, lp).await }
    }
    async fn wait_for_local_health(&self, p: &DeployParams<'_>, lp: &Path) -> Result<StatusCode> {
        match self { Self::Host(a) => a.wait_for_local_health(p, lp).await, Self::Systemd(a) => a.wait_for_local_health(p, lp).await }
    }
    async fn wait_for_stability(&self, p: &DeployParams<'_>, lp: &Path) -> Result<StatusCode> {
        match self { Self::Host(a) => a.wait_for_stability(p, lp).await, Self::Systemd(a) => a.wait_for_stability(p, lp).await }
    }
    async fn wait_for_public_health(&self, p: &DeployParams<'_>, lp: &Path) -> Result<StatusCode> {
        match self { Self::Host(a) => a.wait_for_public_health(p, lp).await, Self::Systemd(a) => a.wait_for_public_health(p, lp).await }
    }
    async fn rollback(&self, s: &RollbackState, p: &DeployParams<'_>, lp: &Path) -> Result<()> {
        match self { Self::Host(a) => a.rollback(s, p, lp).await, Self::Systemd(a) => a.rollback(s, p, lp).await }
    }
    async fn discard_rollback(&self, s: &RollbackState, lp: &Path) -> Result<()> {
        match self { Self::Host(a) => a.discard_rollback(s, lp).await, Self::Systemd(a) => a.discard_rollback(s, lp).await }
    }
    async fn is_running(&self, config: &AliveConfig, env_name: &str) -> Result<bool> {
        match self { Self::Host(a) => a.is_running(config, env_name).await, Self::Systemd(a) => a.is_running(config, env_name).await }
    }
}

// Re-export the trait so callers use `RuntimeLifecycle` not the old `RuntimeAdapter`
pub(crate) use RuntimeLifecycle as RuntimeAdapter;

// =============================================================================
// Private helpers
// =============================================================================

fn resolve_health_path(params: &DeployParams<'_>) -> String {
    if params.environment.healthcheck_path.is_empty() {
        params.config.runtime.healthcheck_path.clone()
    } else {
        params.environment.healthcheck_path.clone()
    }
}

fn require_systemd_config(config: &AliveConfig) -> Result<&crate::types::SystemdConfig> {
    config.systemd.as_ref()
        .ok_or_else(|| anyhow!("systemd runtime requires [systemd] section"))
}

fn resolve_systemd_unit_name(config: &AliveConfig, environment_name: &str) -> String {
    config.systemd.as_ref()
        .map(|s| s.unit_template.replace("{environment}", environment_name))
        .unwrap_or_else(|| format!("alive-{}.service", environment_name))
}

fn resolve_release_dir(
    systemd: &crate::types::SystemdConfig,
    repo_root: &Path,
    environment_name: &str,
) -> std::path::PathBuf {
    repo_root.join(systemd.release_dir_template.replace("{environment}", environment_name))
}

// =============================================================================
// Docker build
// =============================================================================

async fn build_docker(
    params: &BuildParams<'_>,
    pipeline: &TaskPipeline,
    build_stage_num: u8,
    publish_stage_num: u8,
) -> Result<ArtifactRef> {
    let docker = params.alive_config.docker.as_ref()
        .ok_or_else(|| anyhow!("host runtime requires [docker] section"))?;

    let mut artifact = BuildArtifact::local_image(&docker.image_repository, params.build_input)?;
    let iid_file = params.data_dir.join("iids").join(format!("{}.txt", params.build_id));
    let buildx_dir = params.data_dir.join("buildx-config");

    if tokio_fs::try_exists(&iid_file).await.unwrap_or(false) {
        let _ = tokio_fs::remove_file(&iid_file).await;
    }

    let stage = pipeline
        .start_stage(build_stage_num, crate::types::TaskStage::BuildImage, &format!("building {}", artifact.image_ref))
        .await?;

    let mut cmd = Command::new("docker");
    cmd.env("DOCKER_BUILDKIT", "1").env("BUILDX_CONFIG", &buildx_dir)
        .arg("build")
        .arg("--file").arg(params.source_root.join(&docker.dockerfile))
        .arg("--target").arg(&docker.target)
        .arg("--tag").arg(&artifact.image_ref)
        .arg("--iidfile").arg(&iid_file);

    for secret in params.build_secrets {
        cmd.arg("--secret").arg(format!("id={},src={}", secret.id, secret.source.display()));
    }
    cmd.arg("--build-arg").arg(format!("ALIVE_BUILD_COMMIT={}", params.build_input.release_git_sha))
        .arg("--build-arg").arg(format!("ALIVE_BUILD_BRANCH={}", params.git_ref))
        .arg("--build-arg").arg(format!("ALIVE_BUILD_TIME={}", chrono::Utc::now().to_rfc3339()));
    cmd.arg(params.source_root.join(&docker.context));

    run_logged_command_with_timeout(cmd, stage.debug_path(), &format!("docker build {}", params.build_id), BUILD_TIMEOUT).await?;

    let iid = tokio_fs::read_to_string(&iid_file).await
        .with_context(|| format!("failed to read {}", iid_file.display()))?.trim().to_string();
    artifact = artifact.with_local_image_id(iid)?;
    stage.finish_ok(&format!("image built as {}", artifact.image_ref)).await?;

    let pub_stage = pipeline.start_stage(publish_stage_num, crate::types::TaskStage::PublishArtifact, "resolving digest").await?;
    let digest = resolve_local_artifact_digest(&artifact.image_ref, pub_stage.debug_path()).await?;
    pub_stage.finish_ok(&format!("resolved {}", digest)).await?;

    Ok(ArtifactRef::DockerImage { image_ref: artifact.image_ref, image_digest: digest })
}

// =============================================================================
// Systemd build
// =============================================================================

async fn build_systemd(
    params: &BuildParams<'_>,
    pipeline: &TaskPipeline,
    build_stage_num: u8,
    publish_stage_num: u8,
) -> Result<ArtifactRef> {
    let build_cfg = params.alive_config.build.as_ref()
        .ok_or_else(|| anyhow!("systemd runtime requires [build] section"))?;

    let stage = pipeline.start_stage(build_stage_num, crate::types::TaskStage::BuildImage, "running build commands").await?;

    if let Some(setup) = &build_cfg.setup_command {
        let mut cmd = Command::new("bash");
        cmd.arg("-c").arg(setup).current_dir(params.source_root);
        run_logged_command_with_timeout(cmd, stage.debug_path(), &format!("setup: {}", setup), BUILD_TIMEOUT).await?;
    }

    let mut cmd = Command::new("bash");
    cmd.arg("-c").arg(&build_cfg.command).current_dir(params.source_root)
        .env("ALIVE_BUILD_COMMIT", &params.build_input.release_git_sha)
        .env("ALIVE_BUILD_BRANCH", params.git_ref)
        .env("ALIVE_BUILD_TIME", chrono::Utc::now().to_rfc3339());
    run_logged_command_with_timeout(cmd, stage.debug_path(), &format!("build: {}", build_cfg.command), BUILD_TIMEOUT).await?;

    for output in &build_cfg.outputs {
        let full = params.source_root.join(output);
        if !tokio_fs::try_exists(&full).await.unwrap_or(false) {
            return Err(anyhow!("expected build output {} does not exist", full.display()));
        }
    }
    stage.finish_ok("build completed").await?;

    let pub_stage = pipeline.start_stage(publish_stage_num, crate::types::TaskStage::PublishArtifact, "computing digest").await?;
    let mut hasher = Sha256::new();
    for o in &build_cfg.outputs { hasher.update(o.as_bytes()); hasher.update(b"\n"); }
    hasher.update(params.build_input.release_git_sha.as_bytes());
    let digest = format!("sha256:{:x}", hasher.finalize());

    let artifact = BuildArtifact::build_directory(&params.source_root.display().to_string(), params.build_input)?;
    pub_stage.finish_ok(&format!("digest {}", digest)).await?;

    Ok(ArtifactRef::Directory { artifact_ref: artifact.image_ref, content_digest: digest })
}

// =============================================================================
// Docker activate
// =============================================================================

async fn activate_docker(params: &DeployParams<'_>, log_path: &Path) -> Result<()> {
    let name = deployment_container_name(&params.config.project.slug, &params.environment.name);
    let mut cmd = Command::new("docker");
    cmd.arg("run").arg("--detach")
        .arg("--name").arg(&name)
        .arg("--restart").arg("unless-stopped")
        .arg("--env-file").arg(params.sanitized_env_file)
        .arg("--label").arg(format!("alive.application={}", params.config.project.slug))
        .arg("--label").arg(format!("alive.environment={}", params.environment.name))
        .arg("--label").arg("alive.managed_by=alive-deployer")
        .arg("--label").arg(format!("alive.deployment_id={}", params.deployment_id))
        .arg("--label").arg(format!("alive.release_id={}", params.release.release_id));

    if params.config.runtime.privileged { cmd.arg("--privileged"); }
    if let Some(pid) = &params.config.runtime.pid_mode { cmd.arg("--pid").arg(pid); }

    match params.network_mode {
        RuntimeNetworkMode::Bridge => {
            cmd.arg("--publish").arg(format!("{}:{}:{}", LOCAL_BIND_IP, params.host_port, params.config.runtime.container_port));
        }
        RuntimeNetworkMode::Host => { cmd.arg("--network").arg("host"); }
    }

    let staged = params.context.data_dir.join("bind-mounts").join(params.deployment_id);
    for bm in &params.config.runtime.bind_mounts {
        let src = resolve_bind_mount_source(bm, params.context)?;
        let tgt = resolve_bind_mount_target(bm, params.context)?;
        let staged_src = prepare_runtime_bind_mount_source_async(&src, bm.clone(), &staged).await?;
        let spec = if bm.read_only { format!("{}:{}:ro", staged_src.display(), tgt) }
                   else { format!("{}:{}", staged_src.display(), tgt) };
        cmd.arg("--volume").arg(spec);
    }
    cmd.arg(&params.release.artifact_ref);

    crate::logging::run_logged_command(cmd, log_path, &format!("docker run {} ({})", params.deployment_id, name)).await
}

// =============================================================================
// Systemd activate
// =============================================================================

async fn activate_systemd(params: &DeployParams<'_>, log_path: &Path) -> Result<()> {
    let systemd = require_systemd_config(params.config)?;
    let unit = resolve_systemd_unit_name(params.config, &params.environment.name);
    let dir = resolve_release_dir(systemd, &params.context.repo_root, &params.environment.name);
    let current = dir.join("current");
    let release_root = params.context.repo_root.join(&systemd.release_root);

    tokio_fs::create_dir_all(&dir).await
        .with_context(|| format!("failed to create {}", dir.display()))?;

    let ts = chrono::Utc::now().format("%Y%m%d%H%M%S");
    let sha = &params.release.git_sha[..std::cmp::min(8, params.release.git_sha.len())];
    let target = dir.join(format!("{}-{}", ts, sha));

    crate::logging::run_logged_command(
        { let mut c = Command::new("cp"); c.arg("-a").arg(&release_root).arg(&target); c },
        log_path, &format!("cp -a {} {}", release_root.display(), target.display()),
    ).await?;

    if let Some(build_cfg) = &params.config.build {
        for output in &build_cfg.outputs {
            if output == &systemd.release_root { continue; }
            let src = params.context.repo_root.join(output);
            if !tokio_fs::try_exists(&src).await.unwrap_or(false) { continue; }
            let dest = target.join(output);
            if let Some(p) = dest.parent() { let _ = tokio_fs::create_dir_all(p).await; }
            let _ = crate::logging::run_logged_command(
                { let mut c = Command::new("cp"); c.arg("-a").arg(&src).arg(&dest); c },
                log_path, &format!("cp -a {} {}", src.display(), dest.display()),
            ).await;
        }
    }

    // Atomic symlink swap
    let tmp = dir.join(format!("current.{}", params.deployment_id));
    let _ = tokio_fs::remove_file(&tmp).await;
    tokio_fs::symlink(&target, &tmp).await
        .with_context(|| format!("symlink {} -> {}", tmp.display(), target.display()))?;
    tokio_fs::rename(&tmp, &current).await
        .with_context(|| format!("rename {} -> {}", tmp.display(), current.display()))?;

    // Write env file for the systemd unit
    let env_path = dir.join("current.env");
    tokio_fs::copy(params.sanitized_env_file, &env_path).await
        .with_context(|| format!("copy env to {}", env_path.display()))?;

    crate::systemd::restart_systemd_unit(&unit, log_path).await?;
    append_log(log_path, &format!("activated {} via {}\n", target.display(), unit)).await?;
    Ok(())
}
