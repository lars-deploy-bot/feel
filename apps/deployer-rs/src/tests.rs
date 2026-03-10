use std::{
    collections::BTreeMap,
    env, fs,
    net::TcpListener,
    path::PathBuf,
    process::{Command as StdCommand, Stdio as StdStdio},
};

use tokio::process::Command;
use uuid::Uuid;

use crate::config::{
    normalize_env_value, parse_alive_toml, parse_server_id_from_server_config,
    policy_for_environment, resolve_bind_mount_source, resolve_build_secrets,
    resolve_runtime_env_file, runtime_network_mode, validate_application_matches_config,
    write_sanitized_env_file,
};
use crate::docker::{
    docker_reference_repository, remove_container_if_exists, wait_for_container_stability,
    wait_for_health,
};
use crate::logging::{build_log_path, prepare_log, run_logged_command, TaskPipeline};
use crate::types::{
    AliveConfig, ApplicationRow, EnvironmentPolicy, EnvironmentRow, EnvironmentRuntimeOverrides,
    RuntimeNetworkMode, ServiceContext, ServiceEnv,
};

fn temp_file_path(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!("alive-deployer-{}-{}", name, Uuid::new_v4()))
}

fn temp_dir_path(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!("alive-deployer-{}-{}", name, Uuid::new_v4()))
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
fn parse_server_id_from_server_config_reads_server_id() {
    let server_id =
        parse_server_id_from_server_config(r#"{"serverId":"srv_alive_dot_best_138_201_56_93"}"#)
            .expect("failed to parse server config");

    assert_eq!(server_id, "srv_alive_dot_best_138_201_56_93");
}

#[test]
fn docker_reference_repository_handles_registry_ports() {
    assert_eq!(
        docker_reference_repository("ghcr.io/webalive/app:abc123").expect("missing repository"),
        "ghcr.io/webalive/app"
    );
    assert_eq!(
        docker_reference_repository("registry.example.com:5000/webalive/app:abc123")
            .expect("missing repository"),
        "registry.example.com:5000/webalive/app"
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

    let _ = fs::remove_file(source_env);
    let _ = fs::remove_file(output_env);
}

#[test]
fn task_pipeline_promotes_failing_stage_debug_tail_into_summary_log() {
    let data_dir = temp_dir_path("pipeline-log");
    let pipeline = TaskPipeline::for_build(&data_dir, "build_test_123");
    pipeline
        .prepare("build build_test_123 started")
        .expect("failed to prepare pipeline");

    let stage = pipeline
        .start_stage(1, "docker_build", "building image")
        .expect("failed to start stage");
    stage
        .append_debug("first debug line\nsecond debug line\n")
        .expect("failed to write debug log");
    stage
        .finish_error("docker build failed")
        .expect("failed to finish stage");

    let summary =
        fs::read_to_string(pipeline.summary_path()).expect("failed to read pipeline summary log");
    assert!(summary.contains("docker_build failed"));
    assert!(summary.contains("recent debug tail"));
    assert!(summary.contains("second debug line"));

    let _ = fs::remove_dir_all(data_dir);
}

#[test]
fn task_pipeline_writes_agent_readable_state_file() {
    let data_dir = temp_dir_path("pipeline-state");
    let pipeline = TaskPipeline::for_build(&data_dir, "build_state_123");
    pipeline
        .prepare("build build_state_123 started")
        .expect("failed to prepare pipeline");

    let stage = pipeline
        .start_stage(2, "publish_artifact", "pushing artifact")
        .expect("failed to start stage");
    stage
        .append_debug("push failed: registry unavailable\n")
        .expect("failed to append debug");
    stage
        .finish_error("artifact push failed")
        .expect("failed to finish stage");
    pipeline
        .finish_failure("artifact push failed")
        .expect("failed to finish pipeline");

    let state_path = pipeline
        .summary_path()
        .parent()
        .expect("summary log should have parent")
        .join("state.json");
    let raw = fs::read_to_string(state_path).expect("failed to read pipeline state file");
    assert!(raw.contains("\"status\": \"failed\""));
    assert!(raw.contains("\"failed_stage\": \"publish_artifact\""));
    assert!(raw.contains("\"debug_log_path\""));
    assert!(raw.contains("\"result_message\": \"artifact push failed\""));

    let _ = fs::remove_dir_all(data_dir);
}

#[tokio::test]
async fn e2e_builds_and_runs_a_committed_repo_with_complex_alive_toml() {
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
PUBLIC_MARKER = "ready"

[policies.production]
allow_email = true
blocked_env_keys = []

[policies.production.forced_env]
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
    prepare_log(&log_path, "e2e smoke test build").expect("failed to prepare log");

    let dockerfile_path = source_dir.join(&alive_config.docker.dockerfile);
    let build_context = source_dir.join(&alive_config.docker.context);
    let mut build_command = Command::new("docker");
    build_command
        .env("DOCKER_BUILDKIT", "1")
        .env("BUILDX_CONFIG", &buildx_config_dir)
        .arg("build")
        .arg("--file")
        .arg(&dockerfile_path)
        .arg("--target")
        .arg(&alive_config.docker.target)
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
        let mount_spec = if bind_mount.read_only {
            format!("{}:{}:ro", source.display(), bind_mount.target)
        } else {
            format!("{}:{}", source.display(), bind_mount.target)
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
