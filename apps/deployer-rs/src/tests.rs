use std::{
    collections::BTreeMap,
    env, fs,
    net::TcpListener,
    os::unix::fs::PermissionsExt,
    path::PathBuf,
    process::{Command as StdCommand, Stdio as StdStdio},
    sync::OnceLock,
};

use tokio::process::Command;
use tokio::sync::Mutex as AsyncMutex;
use tokio::time::{sleep, Duration};
use tokio_postgres::NoTls;
use uuid::Uuid;

use crate::config::{
    normalize_env_value, parse_alive_toml, parse_server_identity_from_server_config,
    policy_for_environment, prepare_runtime_bind_mount_source, resolve_bind_mount_source,
    resolve_bind_mount_target, resolve_build_secrets, resolve_runtime_env_file, runtime_network_mode,
    validate_application_matches_config, validate_runtime_policy, write_sanitized_env_file,
};
use crate::db::{
    claim_next_build, claim_next_deployment, mark_build_succeeded, mark_deployment_succeeded,
    record_release, renew_lease,
};
use crate::docker::{remove_container_if_exists, wait_for_container_stability};
use crate::health::wait_for_health;
use crate::logging::{
    build_log_path, prepare_log, read_task_snapshot, run_logged_command, TaskPipeline,
};
use crate::runtime_adapter::{ResolvedRuntimeAdapter, RuntimeAdapter};
use crate::source_contract::{BuildArtifact, BuildInput, SourceKind};
use crate::types::{
    AliveConfig, ApplicationRow, BindMount, BindMountServerPath, ClaimedBuild, EnvironmentPolicy,
    EnvironmentRow, EnvironmentRuntimeOverrides, FailureKind, LeaseTarget, RuntimeConfig,
    RuntimeKindConfig, RuntimeNetworkMode, ServiceContext, ServiceEnv, SourceAdapter, TaskKind,
    TaskStage, TaskStatus,
};
use crate::worker::build::{
    compute_local_source_identity, prepare_build_source, resolve_local_source_root,
};
use crate::worker::resolve_data_dir;
use crate::workspace_contract::{
    DeployRequest, PolicyVersion, RuntimeKind, RuntimeTarget, SnapshotId, WorkspaceScope,
};

fn temp_file_path(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!("alive-deployer-{}-{}", name, Uuid::new_v4()))
}

fn temp_dir_path(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!("alive-deployer-{}-{}", name, Uuid::new_v4()))
}

#[test]
fn parse_alive_toml_defaults_source_adapter_to_git() {
    let config = parse_alive_toml(
        r#"
schema = 1

[project]
slug = "alive"
display_name = "Alive"
repo_owner = "lars-deploy-bot"
repo_name = "feel"
default_branch = "main"

[docker]
context = "."
dockerfile = "Dockerfile"
target = "runtime"
image_repository = "alive-control/alive"

[runtime]
env_file = ".env.production"
container_port = 3000
healthcheck_path = "/health"
"#,
    )
    .expect("alive.toml should parse");

    assert_eq!(config.source.adapter, SourceAdapter::Git);
    assert_eq!(config.source.path, ".");
    assert_eq!(config.runtime.kind, RuntimeKindConfig::Host);
}

#[test]
fn parse_alive_toml_reads_local_fs_source_adapter() {
    let config = parse_alive_toml(
        r#"
schema = 1

[project]
slug = "alive"
display_name = "Alive"
repo_owner = "lars-deploy-bot"
repo_name = "feel"
default_branch = "main"

[source]
adapter = "local_fs"
path = "control-plane"

[docker]
context = "."
dockerfile = "Dockerfile"
target = "runtime"
image_repository = "alive-control/alive"

[runtime]
kind = "host"
env_file = ".env.production"
container_port = 3000
healthcheck_path = "/health"
"#,
    )
    .expect("alive.toml should parse");

    assert_eq!(config.source.adapter, SourceAdapter::LocalFs);
    assert_eq!(config.source.path, "control-plane");
    assert_eq!(config.runtime.kind, RuntimeKindConfig::Host);
}

#[test]
fn build_artifact_uses_context_fingerprint_short_id() {
    let snapshot_root = PathBuf::from("/srv/alive/repo");
    let snapshot = BuildInput::new(
        SourceKind::LocalFs,
        snapshot_root.clone(),
        snapshot_root,
        "snap_local_fs_test".to_string(),
        "source-identity".to_string(),
        "0123456789abcdef0123456789abcdef".to_string(),
        PolicyVersion::from_alive_toml("schema = 1").expect("policy version"),
        "abc1234".to_string(),
        "test commit".to_string(),
    )
    .expect("source snapshot");

    let artifact =
        BuildArtifact::local_image("alive-control/alive", &snapshot).expect("build artifact");

    assert_eq!(artifact.image_ref, "alive-control/alive:0123456789ab");
}

#[test]
fn host_runtime_adapter_maps_environment_to_runtime_target() {
    let runtime =
        ResolvedRuntimeAdapter::from_config(RuntimeKindConfig::Host).expect("host runtime adapter");
    let environment = EnvironmentRow {
        environment_id: "dep_env_test".to_string(),
        application_id: "dep_app_test".to_string(),
        server_id: "srv_test".to_string(),
        domain_id: Some("dom_test".to_string()),
        org_id: Some("org_test".to_string()),
        name: "staging".to_string(),
        hostname: "staging.alive.best".to_string(),
        port: 8998,
        healthcheck_path: "/api/health".to_string(),
        allow_email: false,
        runtime_overrides: EnvironmentRuntimeOverrides::default(),
    };
    let runtime_config = RuntimeConfig {
        kind: RuntimeKindConfig::Host,
        env_file: ".env.production".to_string(),
        container_port: 3000,
        healthcheck_path: "/api/health".to_string(),
        network_mode: Some(RuntimeNetworkMode::Host),
        privileged: false,
        pid_mode: None,
        bind_mounts: Vec::new(),
    };

    let target = runtime
        .target_for_environment(&environment)
        .expect("runtime target");
    let runtime_port = runtime
        .runtime_port(&environment, &runtime_config, RuntimeNetworkMode::Host)
        .expect("runtime port");

    assert_eq!(target.runtime, RuntimeKind::Host);
    assert_eq!(target.server_id, "srv_test");
    assert_eq!(runtime_port, 8998);
}

#[test]
fn local_fs_resolution_uses_alive_root() {
    let alive_root = temp_dir_path("alive-root");
    fs::create_dir_all(&alive_root).expect("failed to create alive root");
    let source_root = resolve_local_source_root(alive_root.as_path(), ".").expect("source root");

    assert_eq!(source_root, alive_root);
}

#[tokio::test]
async fn local_fs_prepare_build_source_does_not_touch_github() {
    let repo_root = temp_dir_path("local-fs-source");
    fs::create_dir_all(&repo_root).expect("failed to create repo root");
    fs::write(
        repo_root.join("alive.toml"),
        r#"
schema = 1

[project]
slug = "alive"
display_name = "Alive"
repo_owner = "lars-deploy-bot"
repo_name = "feel"
default_branch = "main"

[source]
adapter = "local_fs"
path = "."

[docker]
context = "."
dockerfile = "Dockerfile"
target = "runtime"
image_repository = "alive-control/alive"

[runtime]
kind = "host"
env_file = ".env.production"
container_port = 3000
healthcheck_path = "/health"
"#,
    )
    .expect("failed to write alive.toml");
    fs::write(repo_root.join("Dockerfile"), "FROM scratch\n").expect("failed to write Dockerfile");

    let application = ApplicationRow {
        slug: "alive".to_string(),
        display_name: "Alive".to_string(),
        repo_owner: "lars-deploy-bot".to_string(),
        repo_name: "feel".to_string(),
        default_branch: "main".to_string(),
        config_path: "alive.toml".to_string(),
    };
    let build = ClaimedBuild {
        build_id: "dep_build_test".to_string(),
        application_id: "dep_app_test".to_string(),
        git_ref: "definitely-not-a-real-ref".to_string(),
        git_sha: "abc1234".to_string(),
        commit_message: "local changes".to_string(),
        lease_token: "lease_test".to_string(),
    };
    let context = ServiceContext {
        env: ServiceEnv {
            database_url: "postgresql://example".to_string(),
            server_config_path: repo_root.join("server-config.json"),
            server_id: "srv_test".to_string(),
            alive_root: repo_root.clone(),
            sites_root: None,
            templates_root: None,
            images_storage: None,
        },
        repo_root: repo_root.clone(),
        data_dir: temp_dir_path("local-fs-data"),
        hostname: "test-host".to_string(),
    };

    let prepared = prepare_build_source(
        &application,
        &context,
        &build,
        &temp_dir_path("unused-source-export"),
        &temp_file_path("unused-source-archive"),
        &temp_file_path("unused-source-log"),
    )
    .await
    .expect("local_fs source should resolve without github");

    assert_eq!(prepared.build_input.source_kind, SourceKind::LocalFs);
    assert_eq!(prepared.build_input.source_root, repo_root);
}

#[tokio::test]
async fn build_context_fingerprint_ignores_dot_git_but_changes_for_included_files() {
    let source_root = temp_dir_path("fingerprint-source");
    fs::create_dir_all(source_root.join(".git")).expect("failed to create .git");
    fs::write(source_root.join("Dockerfile"), "FROM scratch\n")
        .expect("failed to write Dockerfile");
    fs::write(source_root.join("app.txt"), "hello\n").expect("failed to write app.txt");

    let initial = compute_local_source_identity(&source_root, ".")
        .await
        .expect("initial fingerprint");

    fs::write(source_root.join(".git/HEAD"), "ref: refs/heads/main\n")
        .expect("failed to write git head");
    let with_git_change = compute_local_source_identity(&source_root, ".")
        .await
        .expect("fingerprint after .git change");
    assert_eq!(initial, with_git_change);

    fs::write(source_root.join("app.txt"), "hello world\n").expect("failed to update app.txt");
    let with_app_change = compute_local_source_identity(&source_root, ".")
        .await
        .expect("fingerprint after app change");
    assert_ne!(initial, with_app_change);

    fs::write(source_root.join("Dockerfile"), "FROM busybox\n")
        .expect("failed to update Dockerfile");
    let with_dockerfile_change = compute_local_source_identity(&source_root, ".")
        .await
        .expect("fingerprint after dockerfile change");
    assert_ne!(with_app_change, with_dockerfile_change);
}

#[test]
fn unimplemented_runtime_kinds_fail_fast() {
    let e2b =
        ResolvedRuntimeAdapter::from_config(RuntimeKindConfig::E2b).expect_err("e2b should fail");
    let hetzner = ResolvedRuntimeAdapter::from_config(RuntimeKindConfig::Hetzner)
        .expect_err("hetzner should fail");

    assert!(format!("{e2b:#}").contains("not implemented"));
    assert!(format!("{hetzner:#}").contains("not implemented"));
}

fn assert_std_command_success(command: &mut StdCommand, description: &str) {
    let status = command
        .status()
        .unwrap_or_else(|error| panic!("{} failed to start: {}", description, error));
    assert!(status.success(), "{} exited with {}", description, status);
}

fn pick_free_port() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").expect("failed to bind random port");
    listener
        .local_addr()
        .expect("failed to inspect local addr")
        .port()
}

fn docker_available() -> bool {
    StdCommand::new("docker")
        .arg("version")
        .stdout(StdStdio::null())
        .stderr(StdStdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn process_env_lock() -> &'static AsyncMutex<()> {
    static LOCK: OnceLock<AsyncMutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| AsyncMutex::new(()))
}

struct PostgresTestContainer {
    container_name: String,
}

impl Drop for PostgresTestContainer {
    fn drop(&mut self) {
        let _ = StdCommand::new("docker")
            .args(["rm", "-f", &self.container_name])
            .status();
    }
}

async fn connect_test_postgres(port: u16) -> tokio_postgres::Client {
    let database_url = format!("postgresql://postgres:postgres@127.0.0.1:{}/postgres", port);
    for _ in 0..40 {
        match tokio_postgres::connect(&database_url, NoTls).await {
            Ok((client, connection)) => {
                tokio::spawn(async move {
                    let _ = connection.await;
                });
                return client;
            }
            Err(_) => sleep(Duration::from_millis(500)).await,
        }
    }

    panic!(
        "failed to connect to postgres test container on port {}",
        port
    );
}

async fn setup_test_postgres_schema(client: &tokio_postgres::Client) {
    client
        .batch_execute(
            r#"
            CREATE SCHEMA deploy;

            CREATE TYPE deploy.environment_name AS ENUM ('staging', 'production');
            CREATE TYPE deploy.task_status AS ENUM ('pending', 'running', 'succeeded', 'failed', 'cancelled');
            CREATE TYPE deploy.artifact_kind AS ENUM ('docker_image');
            CREATE TYPE deploy.deployment_action AS ENUM ('deploy', 'promote', 'rollback');

            CREATE TABLE deploy.applications (
              application_id text PRIMARY KEY,
              slug text NOT NULL,
              display_name text NOT NULL,
              repo_owner text NOT NULL,
              repo_name text NOT NULL,
              default_branch text NOT NULL,
              config_path text NOT NULL
            );

            CREATE TABLE deploy.builds (
              build_id text PRIMARY KEY,
              application_id text NOT NULL REFERENCES deploy.applications(application_id),
              server_id text NOT NULL,
              status deploy.task_status NOT NULL DEFAULT 'pending',
              git_ref text NOT NULL,
              git_sha text,
              commit_message text,
              alive_toml_snapshot text,
              artifact_kind deploy.artifact_kind NOT NULL DEFAULT 'docker_image',
              artifact_ref text,
              artifact_digest text,
              build_log_path text,
              builder_hostname text,
              error_message text,
              lease_token text,
              lease_expires_at timestamptz,
              attempt_count integer NOT NULL DEFAULT 0,
              metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
              started_at timestamptz,
              finished_at timestamptz,
              created_at timestamptz NOT NULL DEFAULT now(),
              updated_at timestamptz NOT NULL DEFAULT now()
            );

            CREATE TABLE deploy.releases (
              release_id text PRIMARY KEY DEFAULT ('dep_rel_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)),
              application_id text NOT NULL REFERENCES deploy.applications(application_id),
              build_id text NOT NULL UNIQUE REFERENCES deploy.builds(build_id),
              git_sha text NOT NULL,
              commit_message text,
              artifact_kind deploy.artifact_kind NOT NULL DEFAULT 'docker_image',
              artifact_ref text NOT NULL,
              artifact_digest text NOT NULL,
              alive_toml_snapshot text NOT NULL,
              metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
              created_at timestamptz NOT NULL DEFAULT now()
            );

            CREATE TABLE deploy.environments (
              environment_id text PRIMARY KEY,
              application_id text NOT NULL REFERENCES deploy.applications(application_id),
              server_id text NOT NULL,
              name deploy.environment_name NOT NULL,
              hostname text NOT NULL,
              port integer,
              healthcheck_path text NOT NULL DEFAULT '/',
              allow_email boolean NOT NULL DEFAULT false,
              runtime_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
              created_at timestamptz NOT NULL DEFAULT now(),
              updated_at timestamptz NOT NULL DEFAULT now()
            );

            CREATE TABLE deploy.deployments (
              deployment_id text PRIMARY KEY,
              environment_id text NOT NULL REFERENCES deploy.environments(environment_id),
              release_id text NOT NULL REFERENCES deploy.releases(release_id),
              status deploy.task_status NOT NULL DEFAULT 'pending',
              action deploy.deployment_action NOT NULL DEFAULT 'deploy',
              deployment_log_path text,
              healthcheck_status integer,
              healthcheck_checked_at timestamptz,
              error_message text,
              lease_token text,
              lease_expires_at timestamptz,
              attempt_count integer NOT NULL DEFAULT 0,
              metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
              started_at timestamptz,
              finished_at timestamptz,
              created_at timestamptz NOT NULL DEFAULT now(),
              updated_at timestamptz NOT NULL DEFAULT now()
            );
            "#,
        )
        .await
        .expect("failed to create deploy test schema");
}

#[test]
fn normalize_env_value_strips_matching_quotes() {
    assert_eq!(
        normalize_env_value("\"https://example.com\""),
        "https://example.com"
    );
    assert_eq!(normalize_env_value("'redis://example'"), "redis://example");
    assert_eq!(normalize_env_value("plain-value"), "plain-value");
}

#[test]
fn parse_server_identity_from_server_config_reads_alive_root() {
    let (server_id, alive_root, sites_root, templates_root, images_storage) =
        parse_server_identity_from_server_config(
            r#"{"serverId":"srv_alive_dot_best_138_201_56_93","paths":{"aliveRoot":"/srv/alive/repo","sitesRoot":"/srv/sites","templatesRoot":"/srv/templates","imagesStorage":"/srv/images"}}"#,
        )
        .expect("failed to parse server config identity");

    assert_eq!(server_id, "srv_alive_dot_best_138_201_56_93");
    assert_eq!(alive_root, PathBuf::from("/srv/alive/repo"));
    assert_eq!(sites_root, Some(PathBuf::from("/srv/sites")));
    assert_eq!(templates_root, Some(PathBuf::from("/srv/templates")));
    assert_eq!(images_storage, Some(PathBuf::from("/srv/images")));
}

#[tokio::test]
async fn resolve_data_dir_uses_override_when_set() {
    let _env_lock = process_env_lock().lock().await;
    let previous = env::var_os("ALIVE_DEPLOYER_DATA_DIR");

    unsafe {
        env::set_var("ALIVE_DEPLOYER_DATA_DIR", "/tmp/alive-deployer-tests");
    }

    let resolved = resolve_data_dir().expect("failed to resolve override data dir");
    assert_eq!(resolved, PathBuf::from("/tmp/alive-deployer-tests"));

    match previous {
        Some(value) => unsafe {
            env::set_var("ALIVE_DEPLOYER_DATA_DIR", value);
        },
        None => unsafe {
            env::remove_var("ALIVE_DEPLOYER_DATA_DIR");
        },
    }
}

#[test]
fn policy_version_hashes_alive_toml_content() {
    let version = PolicyVersion::from_alive_toml("[runtime]\ncontainer_port = 3000\n")
        .expect("policy version");

    assert!(version.as_str().starts_with("alive_toml_"));
    assert_eq!(version.as_str().len(), "alive_toml_".len() + 24);
}

#[test]
fn deploy_request_uses_org_scoped_workspace_identity() {
    let environment = EnvironmentRow {
        environment_id: "dep_env_test".to_string(),
        application_id: "dep_app_test".to_string(),
        server_id: "srv_test".to_string(),
        domain_id: Some("dom_workspace_123".to_string()),
        org_id: Some("org_workspace_456".to_string()),
        name: "staging".to_string(),
        hostname: "staging.example.test".to_string(),
        port: 8998,
        healthcheck_path: "/api/health".to_string(),
        allow_email: false,
        runtime_overrides: EnvironmentRuntimeOverrides::default(),
    };
    let release = crate::types::ReleaseRow {
        release_id: "dep_rel_test".to_string(),
        application_id: "dep_app_test".to_string(),
        git_sha: "75f5b345aa8b".to_string(),
        commit_message: "test".to_string(),
        artifact_ref: "alive-control/alive:test".to_string(),
        artifact_digest: "sha256:test".to_string(),
        alive_toml_snapshot: "[runtime]\ncontainer_port = 3000\n".to_string(),
        build_fingerprint: None,
    };

    let scope = WorkspaceScope::from_environment(&environment).expect("workspace scope");
    let target =
        RuntimeTarget::for_environment(RuntimeKind::Host, &environment).expect("runtime target");
    let request =
        DeployRequest::from_release(scope.clone(), &release, target).expect("deploy request");

    assert_eq!(scope.organization_id.as_str(), "org_workspace_456");
    assert_eq!(scope.workspace_id.as_str(), "dom_workspace_123");
    assert_eq!(
        request.desired_snapshot.scope.organization_id.as_str(),
        "org_workspace_456"
    );
    assert_eq!(
        request.desired_snapshot.scope.workspace_id.as_str(),
        "dom_workspace_123"
    );
    assert_eq!(
        request.desired_snapshot.snapshot_id,
        SnapshotId::from_git_sha("75f5b345aa8b").expect("snapshot id")
    );
}

#[test]
fn write_sanitized_env_file_normalizes_quoted_values_and_forces_port() {
    let source_env = temp_file_path("source.env");
    let output_env = temp_file_path("output.env");
    let policy = EnvironmentPolicy {
        allow_email: false,
        blocked_env_keys: vec!["MAILER_API_KEY".to_string()],
        forced_env: BTreeMap::from([
            ("MAIL_TYPE".to_string(), "disabled".to_string()),
            ("HOSTNAME".to_string(), "0.0.0.0".to_string()),
        ]),
    };

    fs::write(
        &source_env,
        concat!(
            "KV_REST_API_URL=\"https://example.upstash.io\"\n",
            "MAILER_API_KEY=\"live-secret\"\n",
            "PLAIN_VALUE=hello\n",
        ),
    )
    .expect("failed to write source env");

    write_sanitized_env_file(&source_env, &output_env, &policy, false, 3000)
        .expect("failed to sanitize env");

    let output = fs::read_to_string(&output_env).expect("failed to read sanitized env");
    assert!(output.contains("KV_REST_API_URL=https://example.upstash.io\n"));
    assert!(output.contains("PLAIN_VALUE=hello\n"));
    assert!(output.contains("MAIL_TYPE=disabled\n"));
    assert!(output.contains("HOSTNAME=0.0.0.0\n"));
    assert!(output.contains("PORT=3000\n"));
    assert!(!output.contains("MAILER_API_KEY"));
    let permissions = fs::metadata(&output_env)
        .expect("failed to stat sanitized env")
        .permissions()
        .mode()
        & 0o777;
    assert_eq!(permissions, 0o600);

    let _ = fs::remove_file(source_env);
    let _ = fs::remove_file(output_env);
}

#[test]
fn validate_runtime_policy_requires_production_node_env() {
    let valid_policy = EnvironmentPolicy {
        allow_email: false,
        blocked_env_keys: Vec::new(),
        forced_env: BTreeMap::from([("NODE_ENV".to_string(), "production".to_string())]),
    };
    validate_runtime_policy("staging", &valid_policy).expect("staging policy should be valid");
    validate_runtime_policy("production", &valid_policy)
        .expect("production policy should be valid");

    let invalid_policy = EnvironmentPolicy {
        allow_email: false,
        blocked_env_keys: Vec::new(),
        forced_env: BTreeMap::from([("NODE_ENV".to_string(), "staging".to_string())]),
    };
    let error =
        validate_runtime_policy("staging", &invalid_policy).expect_err("policy should fail");
    assert!(error
        .to_string()
        .contains("staging policy must force NODE_ENV=production"));
}

#[test]
fn prepare_runtime_bind_mount_source_copies_files_with_readable_permissions() {
    let source_file = temp_file_path("server-config-source.json");
    let staged_root = temp_dir_path("bind-mount-root");
    let bind_mount = BindMount {
        source: None,
        source_env: Some("SERVER_CONFIG_PATH".to_string()),
        source_server_path: None,
        target: Some("/var/lib/alive/server-config.json".to_string()),
        target_server_path: None,
        read_only: true,
    };

    fs::write(&source_file, r#"{"serverId":"srv_test"}"#).expect("failed to write source file");
    fs::set_permissions(&source_file, fs::Permissions::from_mode(0o640))
        .expect("failed to chmod source file");

    let staged_source = prepare_runtime_bind_mount_source(&source_file, &bind_mount, &staged_root)
        .expect("failed to stage bind mount source");

    assert_eq!(
        staged_source,
        staged_root.join("var/lib/alive/server-config.json")
    );
    assert_eq!(
        fs::read_to_string(&staged_source).expect("failed to read staged file"),
        r#"{"serverId":"srv_test"}"#
    );
    assert_eq!(
        fs::metadata(&staged_source)
            .expect("failed to stat staged file")
            .permissions()
            .mode()
            & 0o777,
        0o644
    );

    let _ = fs::remove_file(source_file);
    let _ = fs::remove_dir_all(staged_root);
}

#[test]
fn resolve_bind_mount_source_reads_sites_root_from_server_config() {
    let context = ServiceContext {
        env: ServiceEnv {
            database_url: "postgresql://example".to_string(),
            server_config_path: PathBuf::from("/var/lib/alive/server-config.json"),
            server_id: "srv_test".to_string(),
            alive_root: PathBuf::from("/srv/alive/repo"),
            sites_root: Some(PathBuf::from("/srv/workspaces")),
            templates_root: None,
            images_storage: None,
        },
        repo_root: PathBuf::from("/srv/alive/repo"),
        data_dir: temp_dir_path("resolve-bind-source"),
        hostname: "test-host".to_string(),
    };
    let bind_mount = BindMount {
        source: None,
        source_env: None,
        source_server_path: Some(BindMountServerPath::SitesRoot),
        target: None,
        target_server_path: Some(BindMountServerPath::SitesRoot),
        read_only: false,
    };

    let resolved =
        resolve_bind_mount_source(&bind_mount, &context).expect("should resolve sitesRoot path");
    let target =
        resolve_bind_mount_target(&bind_mount, &context).expect("should resolve sitesRoot target");

    assert_eq!(resolved, PathBuf::from("/srv/workspaces"));
    assert_eq!(target, "/srv/workspaces");
}

#[tokio::test]
async fn task_pipeline_promotes_failing_stage_debug_tail_into_summary_log() {
    let data_dir = temp_dir_path("pipeline-log");
    let pipeline = TaskPipeline::for_build(&data_dir, "build_test_123");
    pipeline
        .prepare("build build_test_123 started")
        .await
        .expect("failed to prepare pipeline");

    let stage = pipeline
        .start_stage(1, TaskStage::BuildImage, "building image")
        .await
        .expect("failed to start stage");
    stage
        .append_debug("first debug line\nsecond debug line\n")
        .await
        .expect("failed to write debug log");
    stage
        .finish_error("docker build failed")
        .await
        .expect("failed to finish stage");

    let summary =
        fs::read_to_string(pipeline.summary_path()).expect("failed to read pipeline summary log");
    assert!(summary.contains("build_image failed"));
    assert!(summary.contains("recent debug tail"));
    assert!(summary.contains("second debug line"));

    let _ = fs::remove_dir_all(data_dir);
}

#[tokio::test]
async fn task_pipeline_writes_agent_readable_state_file() {
    let data_dir = temp_dir_path("pipeline-state");
    let pipeline = TaskPipeline::for_build(&data_dir, "build_state_123");
    pipeline
        .prepare("build build_state_123 started")
        .await
        .expect("failed to prepare pipeline");

    let stage = pipeline
        .start_stage(2, TaskStage::PublishArtifact, "pushing artifact")
        .await
        .expect("failed to start stage");
    stage
        .append_debug("push failed: registry unavailable\n")
        .await
        .expect("failed to append debug");
    stage
        .finish_error("artifact push failed")
        .await
        .expect("failed to finish stage");
    pipeline
        .finish_failure("artifact push failed")
        .await
        .expect("failed to finish pipeline");

    let state_path = pipeline
        .summary_path()
        .parent()
        .expect("summary log should have parent")
        .join("state.json");
    let raw = fs::read_to_string(state_path).expect("failed to read pipeline state file");
    assert!(raw.contains("\"status\": \"failed\""));
    assert!(raw.contains("\"failed_stage\": \"publish_artifact\""));
    assert!(raw.contains("\"failure_kind\": \"artifact_publish_failed\""));
    assert!(raw.contains("\"debug_log_path\""));
    assert!(raw.contains("\"result_message\": \"artifact push failed\""));

    let _ = fs::remove_dir_all(data_dir);
}

#[tokio::test]
async fn task_snapshot_aggregates_state_logs_and_events() {
    let data_dir = temp_dir_path("pipeline-snapshot");
    let pipeline = TaskPipeline::for_deployment(&data_dir, "dep_snapshot_123");
    pipeline
        .prepare("deployment dep_snapshot_123 started")
        .await
        .expect("failed to prepare pipeline");

    let stage = pipeline
        .start_stage(5, TaskStage::LocalHealth, "waiting for localhost health")
        .await
        .expect("failed to start stage");
    stage
        .append_debug("first health probe failed\nsecond health probe failed\n")
        .await
        .expect("failed to append debug");
    stage
        .finish_error("health check timed out")
        .await
        .expect("failed to finish stage");
    pipeline
        .finish_failure("health check timed out")
        .await
        .expect("failed to finish pipeline");

    let snapshot = read_task_snapshot(&data_dir, TaskKind::Deployment, "dep_snapshot_123")
        .await
        .expect("failed to read snapshot");

    assert_eq!(snapshot.status, TaskStatus::Failed);
    assert_eq!(snapshot.failed_stage, Some(TaskStage::LocalHealth));
    assert_eq!(snapshot.failure_kind, Some(FailureKind::LocalHealthFailed));
    assert!(snapshot
        .recent_summary_lines
        .iter()
        .any(|line| line.contains("task failed: health check timed out")));
    assert!(snapshot
        .recent_events
        .iter()
        .any(|event| event["event_type"] == "stage_failed"));
    assert_eq!(snapshot.debug_tails.len(), 1);
    assert_eq!(snapshot.debug_tails[0].stage_name, TaskStage::LocalHealth);
    assert!(snapshot.debug_tails[0]
        .lines
        .iter()
        .any(|line| line.contains("second health probe failed")));

    let _ = fs::remove_dir_all(data_dir);
}

#[tokio::test]
async fn task_snapshot_falls_back_to_legacy_logs() {
    let data_dir = temp_dir_path("legacy-snapshot");
    let legacy_log = data_dir.join("logs/builds/dep_build_legacy.log");
    fs::create_dir_all(
        legacy_log
            .parent()
            .expect("legacy log should have parent directory"),
    )
    .expect("failed to create legacy log dir");
    fs::write(
        &legacy_log,
        "legacy build started\nlegacy step complete\nlegacy build done\n",
    )
    .expect("failed to write legacy log");

    let snapshot = read_task_snapshot(&data_dir, TaskKind::Build, "dep_build_legacy")
        .await
        .expect("failed to read legacy snapshot");

    assert_eq!(snapshot.status, TaskStatus::Legacy);
    assert_eq!(snapshot.task_kind, TaskKind::Build);
    assert!(snapshot
        .recent_summary_lines
        .iter()
        .any(|line| line.contains("legacy build done")));
    assert!(snapshot.recent_events.is_empty());
    assert!(snapshot.debug_tails.is_empty());

    let _ = fs::remove_dir_all(data_dir);
}

#[tokio::test]
async fn db_transitions_work_against_live_postgres() {
    if !docker_available() {
        eprintln!("skipping postgres-backed db transition test because docker is unavailable");
        return;
    }

    let port = pick_free_port();
    let container_name = format!("alive-deployer-pg-{}", Uuid::new_v4().simple());
    assert_std_command_success(
        StdCommand::new("docker").args([
            "run",
            "--detach",
            "--rm",
            "--name",
            &container_name,
            "-e",
            "POSTGRES_PASSWORD=postgres",
            "-e",
            "POSTGRES_USER=postgres",
            "-e",
            "POSTGRES_DB=postgres",
            "-p",
            &format!("127.0.0.1:{}:5432", port),
            "postgres:16-alpine",
        ]),
        "docker run postgres",
    );
    let _cleanup = PostgresTestContainer { container_name };

    let client = connect_test_postgres(port).await;
    setup_test_postgres_schema(&client).await;

    client
        .execute(
            "
            INSERT INTO deploy.applications (
              application_id, slug, display_name, repo_owner, repo_name, default_branch, config_path
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ",
            &[
                &"dep_app_test",
                &"test-app",
                &"Test App",
                &"alive",
                &"test-app",
                &"main",
                &"alive.toml",
            ],
        )
        .await
        .expect("failed to insert application");
    client
        .execute(
            "
            INSERT INTO deploy.builds (build_id, application_id, server_id, status, git_ref)
            VALUES ($1, $2, $3, 'pending'::deploy.task_status, $4)
            ",
            &[&"dep_build_test", &"dep_app_test", &"srv-test", &"main"],
        )
        .await
        .expect("failed to insert build");

    let wrong_server_claim = claim_next_build(&client, "srv-other", "builder-host")
        .await
        .expect("failed to claim build from wrong server");
    assert!(wrong_server_claim.is_none());

    let claimed_build = claim_next_build(&client, "srv-test", "builder-host")
        .await
        .expect("failed to claim build")
        .expect("expected build to be claimable");
    assert_eq!(claimed_build.build_id, "dep_build_test");
    renew_lease(
        &client,
        LeaseTarget::Build,
        &claimed_build.build_id,
        &claimed_build.lease_token,
    )
    .await
    .expect("failed to renew build lease");

    let build_log = temp_file_path("build-log");
    let release_id = record_release(
        &client,
        &claimed_build.build_id,
        &claimed_build.application_id,
        "abc123",
        "test commit",
        "registry.example.com/test-app:abc123",
        "registry.example.com/test-app@sha256:123",
        "schema = 1",
        "fingerprint-123",
    )
    .await
    .expect("failed to record release");
    mark_build_succeeded(
        &client,
        &claimed_build.build_id,
        &claimed_build.lease_token,
        "abc123",
        "test commit",
        "schema = 1",
        "registry.example.com/test-app:abc123",
        "registry.example.com/test-app@sha256:123",
        &build_log,
    )
    .await
    .expect("failed to mark build success");

    let build_row = client
        .query_one(
            "
            SELECT
              deploy.builds.status::text,
              deploy.builds.attempt_count,
              deploy.builds.git_sha,
              deploy.builds.artifact_digest,
              deploy.releases.metadata->>'build_fingerprint',
              deploy.builds.lease_expires_at IS NOT NULL
            FROM deploy.builds
            LEFT JOIN deploy.releases ON deploy.releases.build_id = deploy.builds.build_id
            WHERE deploy.builds.build_id = $1
            ",
            &[&claimed_build.build_id],
        )
        .await
        .expect("failed to query build row");
    assert_eq!(build_row.get::<_, String>(0), "succeeded");
    assert_eq!(build_row.get::<_, i32>(1), 1);
    assert_eq!(build_row.get::<_, String>(2), "abc123");
    assert_eq!(
        build_row.get::<_, String>(3),
        "registry.example.com/test-app@sha256:123"
    );
    assert_eq!(
        build_row.get::<_, Option<String>>(4).as_deref(),
        Some("fingerprint-123")
    );
    assert!(build_row.get::<_, bool>(5));

    let reusable_on_same_server =
        crate::db::find_reusable_release(&client, "dep_app_test", "fingerprint-123", "srv-test")
            .await
            .expect("failed to query reusable release on same server");
    assert_eq!(
        reusable_on_same_server
            .expect("expected reusable release on same server")
            .release_id,
        release_id
    );
    let reusable_on_other_server =
        crate::db::find_reusable_release(&client, "dep_app_test", "fingerprint-123", "srv-other")
            .await
            .expect("failed to query reusable release on other server");
    assert!(reusable_on_other_server.is_none());

    client
        .execute(
            "
            UPDATE deploy.builds
            SET status = 'failed'::deploy.task_status
            WHERE build_id = $1
            ",
            &[&claimed_build.build_id],
        )
        .await
        .expect("failed to mark build failed for reuse regression test");
    let reusable_after_failed_build =
        crate::db::find_reusable_release(&client, "dep_app_test", "fingerprint-123", "srv-test")
            .await
            .expect("failed to query reusable release after failed build");
    assert!(reusable_after_failed_build.is_none());

    client
        .execute(
            "
            INSERT INTO deploy.environments (
              environment_id, application_id, server_id, name, hostname, port, healthcheck_path, allow_email
            )
            VALUES ($1, $2, $3, 'staging'::deploy.environment_name, $4, $5, $6, false)
            ",
            &[&"dep_env_test", &"dep_app_test", &"srv-test", &"test.example.com", &3000_i32, &"/health"],
        )
        .await
        .expect("failed to insert environment");
    client
        .execute(
            "
            INSERT INTO deploy.deployments (deployment_id, environment_id, release_id, status)
            VALUES ($1, $2, $3, 'pending'::deploy.task_status)
            ",
            &[&"dep_deploy_test", &"dep_env_test", &release_id],
        )
        .await
        .expect("failed to insert deployment");

    let claimed_deployment = claim_next_deployment(&client, "srv-test")
        .await
        .expect("failed to claim deployment")
        .expect("expected deployment to be claimable");
    assert_eq!(claimed_deployment.deployment_id, "dep_deploy_test");
    renew_lease(
        &client,
        LeaseTarget::Deployment,
        &claimed_deployment.deployment_id,
        &claimed_deployment.lease_token,
    )
    .await
    .expect("failed to renew deployment lease");

    let deploy_log = temp_file_path("deploy-log");
    mark_deployment_succeeded(
        &client,
        &claimed_deployment.deployment_id,
        &claimed_deployment.lease_token,
        200,
        &deploy_log,
    )
    .await
    .expect("failed to mark deployment success");

    let deployment_row = client
        .query_one(
            "
            SELECT status::text, attempt_count, healthcheck_status, deployment_log_path, lease_expires_at IS NOT NULL
            FROM deploy.deployments
            WHERE deployment_id = $1
            ",
            &[&claimed_deployment.deployment_id],
        )
        .await
        .expect("failed to query deployment row");
    assert_eq!(deployment_row.get::<_, String>(0), "succeeded");
    assert_eq!(deployment_row.get::<_, i32>(1), 1);
    assert_eq!(deployment_row.get::<_, Option<i32>>(2), Some(200));
    assert_eq!(
        deployment_row.get::<_, Option<String>>(3).as_deref(),
        Some(deploy_log.to_string_lossy().as_ref())
    );
    assert!(deployment_row.get::<_, bool>(4));
}

#[tokio::test]
async fn e2e_builds_and_runs_a_committed_repo_with_complex_alive_toml() {
    let _env_lock = process_env_lock().lock().await;
    // Trigger: a committed git repo with a simple app and a non-trivial alive.toml enters the deployer flow.
    // Expected user-visible outcome: the built container serves healthy HTTP responses and exposes built assets.
    // Negative boundary: blocked env vars must not reach runtime, and mounts/secrets must be required for startup.
    // Completion signal: the health endpoint stabilizes and fetched files confirm the runtime/build contract.
    if !docker_available() {
        eprintln!("skipping docker-backed deployer e2e smoke test because docker is unavailable");
        return;
    }

    let run_id = Uuid::new_v4().simple().to_string();
    let host_root = temp_dir_path("e2e-smoke");
    let repo_dir = host_root.join("repo");
    let source_dir = host_root.join("source");
    let data_dir = host_root.join("data");
    let runtime_dir = host_root.join("runtime");
    let build_secrets_dir = host_root.join("build-secrets");
    let buildx_config_dir = host_root.join("buildx-config");
    let mounts_config_dir = host_root.join("mounts/config");
    let mounts_payload_dir = host_root.join("mounts/payload");
    let server_config_path = host_root.join("server-config.json");
    let archive_path = host_root.join("repo.tar.gz");
    let log_path = build_log_path(&data_dir, "e2e-smoke");
    let host_port = pick_free_port();
    let image_ref = format!("alive-test/smoke:{}", &run_id[..12]);
    let container_name = format!("alive-e2e-{}", &run_id[..12]);
    let secret_env_key = format!("TEST_E2E_SECRET_PATH_{}", run_id);
    let payload_env_key = format!("TEST_E2E_PAYLOAD_DIR_{}", run_id);

    fs::create_dir_all(&repo_dir).expect("failed to create repo dir");
    fs::create_dir_all(&source_dir).expect("failed to create source dir");
    fs::create_dir_all(&data_dir).expect("failed to create data dir");
    fs::create_dir_all(&runtime_dir).expect("failed to create runtime dir");
    fs::create_dir_all(&build_secrets_dir).expect("failed to create secrets dir");
    fs::create_dir_all(&buildx_config_dir).expect("failed to create buildx config dir");
    fs::create_dir_all(&mounts_config_dir).expect("failed to create config mount dir");
    fs::create_dir_all(&mounts_payload_dir).expect("failed to create payload mount dir");
    fs::create_dir_all(repo_dir.join("public")).expect("failed to create public dir");

    let runtime_env_path = runtime_dir.join("runtime.env");
    let path_secret_path = build_secrets_dir.join("path-secret.txt");
    let env_secret_path = build_secrets_dir.join("env-secret.txt");
    let mounted_config_path = mounts_config_dir.join("server-config.json");
    let mounted_payload_path = mounts_payload_dir.join("payload.txt");

    fs::write(
        &server_config_path,
        r#"{"serverId":"srv_e2e_smoke","serverIp":"127.0.0.1"}"#,
    )
    .expect("failed to write server config");
    fs::write(&path_secret_path, "path-secret-value\n").expect("failed to write path secret");
    fs::write(&env_secret_path, "env-secret-value\n").expect("failed to write env secret");
    fs::write(&mounted_config_path, r#"{"mounted":true}"#).expect("failed to write mounted config");
    fs::write(&mounted_payload_path, "payload-ok\n").expect("failed to write mounted payload");
    fs::write(
        &runtime_env_path,
        concat!(
            "QUOTED_VALUE=\"https://example.test\"\n",
            "MAILER_API_KEY=\"blocked-in-staging\"\n",
        ),
    )
    .expect("failed to write runtime env");
    fs::write(repo_dir.join("public/health"), "ok\n").expect("failed to write health file");
    fs::write(repo_dir.join("public/index.html"), "<html>ok</html>\n")
        .expect("failed to write index file");

    let alive_toml = format!(
        r#"
schema = 1

[project]
slug = "smoke-app"
display_name = "Smoke App"
repo_owner = "local"
repo_name = "smoke-app"
default_branch = "main"

[docker]
context = "."
dockerfile = "Dockerfile"
target = "runtime"
image_repository = "alive-test/smoke"

[runtime]
env_file = "runtime/runtime.env"
container_port = 8080
healthcheck_path = "/health"
network_mode = "bridge"

[[build_secrets]]
id = "path_secret"
path = "build-secrets/path-secret.txt"

[[build_secrets]]
id = "env_secret"
env = "{secret_env_key}"

[[build_secrets]]
id = "server_config"

[[runtime.bind_mounts]]
source = "{mounted_config_source}"
target = "/mounted/config/server-config.json"
read_only = true

[[runtime.bind_mounts]]
source_env = "{payload_env_key}"
target = "/mounted/payload"
read_only = true

[policies.staging]
allow_email = false
blocked_env_keys = ["MAILER_API_KEY"]

[policies.staging.forced_env]
NODE_ENV = "production"
PUBLIC_MARKER = "ready"

[policies.production]
allow_email = true
blocked_env_keys = []

[policies.production.forced_env]
NODE_ENV = "production"
PUBLIC_MARKER = "prod"
"#,
        mounted_config_source = mounted_config_path.display()
    );
    fs::write(repo_dir.join("alive.toml"), alive_toml).expect("failed to write alive.toml");
    fs::write(
        repo_dir.join("Dockerfile"),
        r#"# syntax=docker/dockerfile:1.7
FROM busybox:1.36 AS runtime
WORKDIR /app
RUN mkdir -p /app/public /www /mounted/config /mounted/payload
COPY public /app/public
RUN --mount=type=secret,id=path_secret cat /run/secrets/path_secret > /app/public/path-secret.txt
RUN --mount=type=secret,id=env_secret cat /run/secrets/env_secret > /app/public/env-secret.txt
RUN --mount=type=secret,id=server_config cat /run/secrets/server_config > /app/public/server-config.json
CMD ["sh","-c","test \"$PUBLIC_MARKER\" = \"ready\" && test -z \"$MAILER_API_KEY\" && test \"$QUOTED_VALUE\" = \"https://example.test\" && test -f /mounted/config/server-config.json && test -f /mounted/payload/payload.txt && cp -R /app/public/. /www/ && exec httpd -f -p \"$PORT\" -h /www"]
"#,
    )
    .expect("failed to write Dockerfile");

    env::set_var(&secret_env_key, &env_secret_path);
    env::set_var(&payload_env_key, &mounts_payload_dir);

    struct Cleanup {
        container_name: String,
        image_ref: String,
        host_root: PathBuf,
        env_keys: Vec<String>,
    }

    impl Drop for Cleanup {
        fn drop(&mut self) {
            let _ = StdCommand::new("docker")
                .args(["rm", "-f", &self.container_name])
                .status();
            let _ = StdCommand::new("docker")
                .args(["rmi", "-f", &self.image_ref])
                .status();
            for key in &self.env_keys {
                env::remove_var(key);
            }
            let _ = fs::remove_dir_all(&self.host_root);
        }
    }

    let _cleanup = Cleanup {
        container_name: container_name.clone(),
        image_ref: image_ref.clone(),
        host_root: host_root.clone(),
        env_keys: vec![secret_env_key.clone(), payload_env_key.clone()],
    };

    assert_std_command_success(
        StdCommand::new("git")
            .arg("init")
            .arg("-b")
            .arg("main")
            .arg(&repo_dir),
        "git init",
    );
    assert_std_command_success(
        StdCommand::new("git").arg("-C").arg(&repo_dir).args([
            "config",
            "user.email",
            "e2e@example.com",
        ]),
        "git config user.email",
    );
    assert_std_command_success(
        StdCommand::new("git")
            .arg("-C")
            .arg(&repo_dir)
            .args(["config", "user.name", "E2E"]),
        "git config user.name",
    );
    assert_std_command_success(
        StdCommand::new("git")
            .arg("-C")
            .arg(&repo_dir)
            .args(["add", "."]),
        "git add",
    );
    assert_std_command_success(
        StdCommand::new("git")
            .arg("-C")
            .arg(&repo_dir)
            .args(["commit", "-m", "initial commit"]),
        "git commit",
    );
    assert_std_command_success(
        StdCommand::new("git")
            .arg("-C")
            .arg(&repo_dir)
            .arg("archive")
            .arg("--format=tar.gz")
            .arg(format!("--output={}", archive_path.display()))
            .arg("HEAD"),
        "git archive",
    );
    assert_std_command_success(
        StdCommand::new("tar")
            .arg("-xzf")
            .arg(&archive_path)
            .arg("-C")
            .arg(&source_dir),
        "tar extract",
    );

    let context = ServiceContext {
        env: ServiceEnv {
            database_url: "postgresql://example.invalid/alive".to_string(),
            server_config_path: server_config_path.clone(),
            server_id: "srv_e2e_smoke".to_string(),
            alive_root: host_root.clone(),
            sites_root: Some(PathBuf::from("/srv/workspaces")),
            templates_root: None,
            images_storage: None,
        },
        repo_root: host_root.clone(),
        data_dir: data_dir.clone(),
        hostname: "test-host".to_string(),
    };
    let application = ApplicationRow {
        slug: "smoke-app".to_string(),
        display_name: "Smoke App".to_string(),
        repo_owner: "local".to_string(),
        repo_name: "smoke-app".to_string(),
        default_branch: "main".to_string(),
        config_path: "alive.toml".to_string(),
    };

    let alive_toml_snapshot = fs::read_to_string(source_dir.join("alive.toml"))
        .expect("failed to read extracted alive.toml");
    let alive_config: AliveConfig =
        parse_alive_toml(&alive_toml_snapshot).expect("failed to parse alive.toml");
    validate_application_matches_config(&application, &alive_config)
        .expect("application metadata should match alive.toml");
    prepare_log(&log_path, "e2e smoke test build")
        .await
        .expect("failed to prepare log");

    let docker_config = alive_config.docker.as_ref().expect("docker config required for this test");
    let dockerfile_path = source_dir.join(&docker_config.dockerfile);
    let build_context = source_dir.join(&docker_config.context);
    let mut build_command = Command::new("docker");
    build_command
        .env("DOCKER_BUILDKIT", "1")
        .env("BUILDX_CONFIG", &buildx_config_dir)
        .arg("build")
        .arg("--file")
        .arg(&dockerfile_path)
        .arg("--target")
        .arg(&docker_config.target)
        .arg("--tag")
        .arg(&image_ref);
    for secret in resolve_build_secrets(&context.repo_root, &alive_config, &context.env)
        .expect("failed to resolve build secrets")
    {
        build_command.arg("--secret").arg(format!(
            "id={},src={}",
            secret.id,
            secret.source.display()
        ));
    }
    build_command.arg(&build_context);
    if let Err(error) =
        run_logged_command(build_command, &log_path, "docker build e2e smoke image").await
    {
        let log_output =
            fs::read_to_string(&log_path).unwrap_or_else(|_| "<missing build log>".to_string());
        panic!("docker build should succeed: {}\n{}", error, log_output);
    }

    let environment = EnvironmentRow {
        environment_id: "dep_env_e2e".to_string(),
        application_id: "dep_app_e2e".to_string(),
        server_id: "srv_e2e_smoke".to_string(),
        domain_id: None,
        org_id: None,
        name: "staging".to_string(),
        hostname: "unused.local".to_string(),
        port: i32::from(host_port),
        healthcheck_path: "/health".to_string(),
        allow_email: false,
        runtime_overrides: EnvironmentRuntimeOverrides::default(),
    };
    let policy = policy_for_environment(&alive_config, "staging").expect("missing staging policy");
    let env_file = resolve_runtime_env_file(&alive_config, &environment, &context)
        .expect("failed to resolve runtime env");
    let sanitized_env_file = data_dir.join("runtime-env/e2e-smoke.env");
    write_sanitized_env_file(
        &env_file,
        &sanitized_env_file,
        policy,
        environment.allow_email,
        alive_config.runtime.container_port,
    )
    .expect("failed to sanitize runtime env");

    let sanitized_content =
        fs::read_to_string(&sanitized_env_file).expect("failed to read sanitized env file");
    assert!(sanitized_content.contains("QUOTED_VALUE=https://example.test\n"));
    assert!(sanitized_content.contains("PUBLIC_MARKER=ready\n"));
    assert!(sanitized_content.contains("PORT=8080\n"));
    assert!(!sanitized_content.contains("MAILER_API_KEY"));

    remove_container_if_exists(&container_name, &log_path)
        .await
        .expect("failed to clear test container");
    let mut run_command = Command::new("docker");
    run_command
        .arg("run")
        .arg("--detach")
        .arg("--name")
        .arg(&container_name)
        .arg("--restart")
        .arg("no")
        .arg("--env-file")
        .arg(&sanitized_env_file);
    match runtime_network_mode(&alive_config.runtime).expect("runtime network mode should be valid")
    {
        RuntimeNetworkMode::Bridge => {
            run_command.arg("--publish").arg(format!(
                "127.0.0.1:{}:{}",
                host_port, alive_config.runtime.container_port
            ));
        }
        RuntimeNetworkMode::Host => {
            panic!("test expects bridge networking");
        }
    }
    for bind_mount in &alive_config.runtime.bind_mounts {
        let source =
            resolve_bind_mount_source(bind_mount, &context).expect("failed to resolve bind mount");
        let target =
            resolve_bind_mount_target(bind_mount, &context).expect("failed to resolve bind target");
        let mount_spec = if bind_mount.read_only {
            format!("{}:{}:ro", source.display(), target)
        } else {
            format!("{}:{}", source.display(), target)
        };
        run_command.arg("--volume").arg(mount_spec);
    }
    run_command.arg(&image_ref);
    if let Err(error) =
        run_logged_command(run_command, &log_path, "docker run e2e smoke container").await
    {
        let log_output =
            fs::read_to_string(&log_path).unwrap_or_else(|_| "<missing build log>".to_string());
        panic!("docker run should succeed: {}\n{}", error, log_output);
    }

    wait_for_health(host_port, "/health", &log_path)
        .await
        .expect("health check should pass");
    wait_for_container_stability(&container_name, host_port, "/health", &log_path)
        .await
        .expect("container should stay healthy");

    let client = reqwest::Client::new();
    let path_secret = client
        .get(format!("http://127.0.0.1:{}/path-secret.txt", host_port))
        .send()
        .await
        .expect("failed to fetch path secret");
    assert!(path_secret.status().is_success());
    assert_eq!(
        path_secret
            .text()
            .await
            .expect("failed to read path secret body"),
        "path-secret-value\n"
    );

    let env_secret = client
        .get(format!("http://127.0.0.1:{}/env-secret.txt", host_port))
        .send()
        .await
        .expect("failed to fetch env secret");
    assert!(env_secret.status().is_success());
    assert_eq!(
        env_secret
            .text()
            .await
            .expect("failed to read env secret body"),
        "env-secret-value\n"
    );

    let server_config = client
        .get(format!("http://127.0.0.1:{}/server-config.json", host_port))
        .send()
        .await
        .expect("failed to fetch baked server config");
    assert!(server_config.status().is_success());
    assert!(server_config
        .text()
        .await
        .expect("failed to read baked server config")
        .contains("srv_e2e_smoke"));
}
