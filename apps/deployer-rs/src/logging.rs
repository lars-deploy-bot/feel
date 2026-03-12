use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Instant;

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::fs as tokio_fs;
use tokio::process::Command;
use tokio::task::spawn_blocking;

use crate::types::{FailureKind, TaskEvent, TaskEventType, TaskKind, TaskStage, TaskStatus};

const FAILURE_DEBUG_TAIL_LINES: usize = 80;
const SNAPSHOT_SUMMARY_TAIL_LINES: usize = 40;
const SNAPSHOT_EVENT_TAIL_LINES: usize = 30;
const TAIL_READ_CHUNK_BYTES: usize = 8192;

#[derive(Clone)]
pub(crate) struct TaskPipeline {
    task_kind: TaskKind,
    task_id: String,
    summary_path: PathBuf,
    event_path: PathBuf,
    state_path: PathBuf,
    stages_dir: PathBuf,
}

pub(crate) struct PipelineStage {
    task_kind: TaskKind,
    task_id: String,
    stage_name: TaskStage,
    summary_path: PathBuf,
    event_path: PathBuf,
    debug_path: PathBuf,
    started_at: Instant,
}

#[derive(Serialize, Deserialize)]
pub(crate) struct PipelineState {
    task_kind: TaskKind,
    task_id: String,
    status: TaskStatus,
    current_stage: Option<TaskStage>,
    failed_stage: Option<TaskStage>,
    #[serde(default)]
    failure_kind: Option<FailureKind>,
    last_error: Option<String>,
    summary_log_path: String,
    event_log_path: String,
    #[serde(default)]
    started_at: String,
    #[serde(default)]
    finished_at: Option<String>,
    #[serde(default)]
    duration_seconds: Option<u64>,
    updated_at: String,
    stages: Vec<PipelineStageState>,
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct PipelineStageState {
    order: u8,
    name: TaskStage,
    status: TaskStatus,
    summary_message: String,
    debug_log_path: String,
    started_at: Option<String>,
    finished_at: Option<String>,
    duration_seconds: Option<u64>,
    result_message: Option<String>,
}

#[derive(Serialize)]
pub(crate) struct TaskSnapshot {
    pub(crate) task_kind: TaskKind,
    pub(crate) task_id: String,
    pub(crate) status: TaskStatus,
    pub(crate) current_stage: Option<TaskStage>,
    pub(crate) failed_stage: Option<TaskStage>,
    pub(crate) failure_kind: Option<FailureKind>,
    pub(crate) last_error: Option<String>,
    pub(crate) summary_log_path: String,
    pub(crate) event_log_path: String,
    pub(crate) started_at: String,
    pub(crate) finished_at: Option<String>,
    pub(crate) duration_seconds: Option<u64>,
    pub(crate) stages: Vec<PipelineStageState>,
    pub(crate) recent_summary_lines: Vec<String>,
    pub(crate) recent_events: Vec<Value>,
    pub(crate) debug_tails: Vec<TaskDebugTail>,
}

#[derive(Serialize)]
pub(crate) struct TaskDebugTail {
    pub(crate) stage_name: TaskStage,
    pub(crate) debug_log_path: String,
    pub(crate) lines: Vec<String>,
}

pub(crate) async fn ensure_data_dirs(data_dir: &Path) -> Result<()> {
    let data_dir = data_dir.to_path_buf();
    run_blocking_io("ensure data dirs", move || {
        ensure_data_dirs_blocking(&data_dir)
    })
    .await
}

pub(crate) async fn prepare_log(log_path: &Path, header: &str) -> Result<()> {
    let log_path = log_path.to_path_buf();
    let header = header.to_string();
    run_blocking_io("prepare log", move || {
        prepare_log_blocking(&log_path, &header)
    })
    .await
}

pub(crate) async fn append_log(log_path: &Path, message: &str) -> Result<()> {
    let log_path = log_path.to_path_buf();
    let message = message.to_string();
    run_blocking_io("append log", move || {
        append_log_blocking(&log_path, &message)
    })
    .await
}

pub(crate) fn build_log_path(data_dir: &Path, build_id: &str) -> PathBuf {
    data_dir
        .join("pipelines")
        .join("builds")
        .join(build_id)
        .join("pipeline.log")
}

pub(crate) fn deployment_log_path(data_dir: &Path, deployment_id: &str) -> PathBuf {
    data_dir
        .join("pipelines")
        .join("deployments")
        .join(deployment_id)
        .join("pipeline.log")
}

pub(crate) fn build_event_path(data_dir: &Path, build_id: &str) -> PathBuf {
    data_dir
        .join("pipelines")
        .join("builds")
        .join(build_id)
        .join("events.ndjson")
}

pub(crate) fn deployment_event_path(data_dir: &Path, deployment_id: &str) -> PathBuf {
    data_dir
        .join("pipelines")
        .join("deployments")
        .join(deployment_id)
        .join("events.ndjson")
}

pub(crate) async fn append_task_event(
    event_path: &Path,
    task_kind: TaskKind,
    task_id: &str,
    event_type: TaskEventType,
    details: Value,
) -> Result<()> {
    let event_path = event_path.to_path_buf();
    let task_id = task_id.to_string();
    run_blocking_io("append task event", move || {
        append_task_event_blocking(&event_path, task_kind, &task_id, event_type, details)
    })
    .await
}

pub(crate) async fn run_logged_command(
    mut command: Command,
    log_path: &Path,
    description: &str,
) -> Result<()> {
    append_log(log_path, &format!("$ {}\n", description)).await?;

    let stdout = tokio_fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .await
        .with_context(|| format!("failed to open {}", log_path.display()))?;
    let stderr = stdout
        .try_clone()
        .await
        .with_context(|| format!("failed to clone {}", log_path.display()))?;

    command.stdout(Stdio::from(stdout.into_std().await));
    command.stderr(Stdio::from(stderr.into_std().await));

    let status = command
        .status()
        .await
        .context("failed to execute child process")?;
    if !status.success() {
        return Err(anyhow::anyhow!(
            "{} failed with status {}",
            description,
            status
        ));
    }

    append_log(log_path, "\n").await?;
    Ok(())
}

pub(crate) async fn run_logged_command_with_timeout(
    mut command: Command,
    log_path: &Path,
    description: &str,
    timeout_duration: std::time::Duration,
) -> Result<()> {
    append_log(
        log_path,
        &format!("$ {} (timeout: {:?})\n", description, timeout_duration),
    )
    .await?;

    let stdout = tokio_fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .await
        .with_context(|| format!("failed to open {}", log_path.display()))?;
    let stderr = stdout
        .try_clone()
        .await
        .with_context(|| format!("failed to clone {}", log_path.display()))?;

    command.stdout(Stdio::from(stdout.into_std().await));
    command.stderr(Stdio::from(stderr.into_std().await));

    let mut child = command.spawn().context("failed to spawn child process")?;

    match tokio::time::timeout(timeout_duration, child.wait()).await {
        Ok(Ok(status)) if status.success() => {
            append_log(log_path, "\n").await?;
            Ok(())
        }
        Ok(Ok(status)) => Err(anyhow::anyhow!(
            "{} failed with status {}",
            description,
            status
        )),
        Ok(Err(error)) => Err(anyhow::anyhow!(
            "failed to wait for {}: {}",
            description,
            error
        )),
        Err(_) => {
            let _ = child.kill().await;
            append_log(
                log_path,
                &format!("\ntimed out after {:?}\n", timeout_duration),
            )
            .await?;
            Err(anyhow::anyhow!(
                "{} timed out after {:?}",
                description,
                timeout_duration
            ))
        }
    }
}

pub(crate) async fn read_task_snapshot(
    data_dir: &Path,
    task_kind: TaskKind,
    task_id: &str,
) -> Result<TaskSnapshot> {
    let data_dir = data_dir.to_path_buf();
    let task_id = task_id.to_string();
    run_blocking_io("read task snapshot", move || {
        read_task_snapshot_blocking(&data_dir, task_kind, &task_id)
    })
    .await
}

pub(crate) fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

impl TaskPipeline {
    pub(crate) fn for_build(data_dir: &Path, build_id: &str) -> Self {
        Self {
            task_kind: TaskKind::Build,
            task_id: build_id.to_string(),
            summary_path: build_log_path(data_dir, build_id),
            event_path: build_event_path(data_dir, build_id),
            state_path: data_dir
                .join("pipelines")
                .join("builds")
                .join(build_id)
                .join("state.json"),
            stages_dir: data_dir
                .join("pipelines")
                .join("builds")
                .join(build_id)
                .join("stages"),
        }
    }

    pub(crate) fn for_deployment(data_dir: &Path, deployment_id: &str) -> Self {
        Self {
            task_kind: TaskKind::Deployment,
            task_id: deployment_id.to_string(),
            summary_path: deployment_log_path(data_dir, deployment_id),
            event_path: deployment_event_path(data_dir, deployment_id),
            state_path: data_dir
                .join("pipelines")
                .join("deployments")
                .join(deployment_id)
                .join("state.json"),
            stages_dir: data_dir
                .join("pipelines")
                .join("deployments")
                .join(deployment_id)
                .join("stages"),
        }
    }

    pub(crate) async fn prepare(&self, header: &str) -> Result<()> {
        let pipeline = self.clone();
        let header = header.to_string();
        run_blocking_io("prepare task pipeline", move || {
            pipeline.prepare_blocking(&header)
        })
        .await
    }

    pub(crate) fn summary_path(&self) -> &Path {
        &self.summary_path
    }

    pub(crate) async fn append_summary(&self, message: &str) -> Result<()> {
        let pipeline = self.clone();
        let message = message.to_string();
        run_blocking_io("append task summary", move || {
            pipeline.append_summary_blocking(&message)
        })
        .await
    }

    pub(crate) async fn emit(&self, event_type: TaskEventType, details: Value) -> Result<()> {
        let pipeline = self.clone();
        run_blocking_io("emit task event", move || {
            pipeline.emit_blocking(event_type, details)
        })
        .await
    }

    pub(crate) async fn start_stage(
        &self,
        order: u8,
        stage_name: TaskStage,
        summary_message: &str,
    ) -> Result<PipelineStage> {
        let pipeline = self.clone();
        let summary_message = summary_message.to_string();
        run_blocking_io("start task stage", move || {
            pipeline.start_stage_blocking(order, stage_name, &summary_message)
        })
        .await
    }

    pub(crate) async fn finish_success(&self, message: &str) -> Result<()> {
        let pipeline = self.clone();
        let message = message.to_string();
        run_blocking_io("finish task success", move || {
            pipeline.finish_success_blocking(&message)
        })
        .await
    }

    pub(crate) async fn finish_failure(&self, message: &str) -> Result<()> {
        let pipeline = self.clone();
        let message = message.to_string();
        run_blocking_io("finish task failure", move || {
            pipeline.finish_failure_blocking(&message)
        })
        .await
    }

    fn prepare_blocking(&self, header: &str) -> Result<()> {
        let started_at = Utc::now().to_rfc3339();
        if let Some(parent) = self.summary_path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("failed to create {}", parent.display()))?;
        }
        if let Some(parent) = self.event_path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("failed to create {}", parent.display()))?;
        }
        fs::create_dir_all(&self.stages_dir)
            .with_context(|| format!("failed to create {}", self.stages_dir.display()))?;
        prepare_log_blocking(&self.summary_path, header)?;
        fs::write(&self.event_path, "")
            .with_context(|| format!("failed to create {}", self.event_path.display()))?;
        self.write_state_blocking(PipelineState {
            task_kind: self.task_kind,
            task_id: self.task_id.clone(),
            status: TaskStatus::Running,
            current_stage: None,
            failed_stage: None,
            failure_kind: None,
            last_error: None,
            summary_log_path: path_to_string(&self.summary_path),
            event_log_path: path_to_string(&self.event_path),
            started_at: started_at.clone(),
            finished_at: None,
            duration_seconds: None,
            updated_at: started_at,
            stages: Vec::new(),
        })
    }

    fn append_summary_blocking(&self, message: &str) -> Result<()> {
        append_log_blocking(&self.summary_path, message)
    }

    fn emit_blocking(&self, event_type: TaskEventType, details: Value) -> Result<()> {
        append_task_event_blocking(
            &self.event_path,
            self.task_kind,
            &self.task_id,
            event_type,
            details,
        )
    }

    fn start_stage_blocking(
        &self,
        order: u8,
        stage_name: TaskStage,
        summary_message: &str,
    ) -> Result<PipelineStage> {
        let debug_path = self
            .stages_dir
            .join(format!("{:02}-{}.log", order, stage_name.slug()));
        prepare_log_blocking(
            &debug_path,
            &format!("stage {} started", stage_name.as_str()),
        )?;
        append_log_blocking(
            &self.summary_path,
            &format!(
                "[{:02}] {}: {} (debug: {})\n",
                order,
                stage_name.as_str(),
                summary_message,
                debug_path.display()
            ),
        )?;
        append_task_event_blocking(
            &self.event_path,
            self.task_kind,
            &self.task_id,
            TaskEventType::StageStarted,
            serde_json::json!({
                "stage_name": stage_name,
                "stage_order": order,
                "debug_log_path": path_to_string(&debug_path),
                "message": summary_message,
            }),
        )?;

        let mut state = self.read_state_blocking()?;
        upsert_stage_state(
            &mut state.stages,
            PipelineStageState {
                order,
                name: stage_name,
                status: TaskStatus::Running,
                summary_message: summary_message.to_string(),
                debug_log_path: path_to_string(&debug_path),
                started_at: Some(Utc::now().to_rfc3339()),
                finished_at: None,
                duration_seconds: None,
                result_message: None,
            },
        );
        state.current_stage = Some(stage_name);
        state.updated_at = Utc::now().to_rfc3339();
        self.write_state_blocking(state)?;

        Ok(PipelineStage {
            task_kind: self.task_kind,
            task_id: self.task_id.clone(),
            stage_name,
            summary_path: self.summary_path.clone(),
            event_path: self.event_path.clone(),
            debug_path,
            started_at: Instant::now(),
        })
    }

    fn finish_success_blocking(&self, message: &str) -> Result<()> {
        let mut state = self.read_state_blocking()?;
        state.status = TaskStatus::Succeeded;
        state.current_stage = None;
        state.failed_stage = None;
        state.failure_kind = None;
        state.last_error = None;
        state.finished_at = Some(Utc::now().to_rfc3339());
        state.duration_seconds = duration_seconds_from_state(&state);
        state.updated_at = state
            .finished_at
            .clone()
            .unwrap_or_else(|| Utc::now().to_rfc3339());
        self.write_state_blocking(state)?;
        self.append_summary_blocking(&format!("task succeeded: {}\n", message))
    }

    fn finish_failure_blocking(&self, message: &str) -> Result<()> {
        let mut state = self.read_state_blocking()?;
        state.status = TaskStatus::Failed;
        state.current_stage = None;
        if state.failure_kind.is_none() {
            state.failure_kind = Some(self.task_kind.fallback_failure_kind());
        }
        state.last_error = Some(message.to_string());
        state.finished_at = Some(Utc::now().to_rfc3339());
        state.duration_seconds = duration_seconds_from_state(&state);
        state.updated_at = state
            .finished_at
            .clone()
            .unwrap_or_else(|| Utc::now().to_rfc3339());
        self.write_state_blocking(state)?;
        self.append_summary_blocking(&format!("task failed: {}\n", message))
    }

    fn read_state_blocking(&self) -> Result<PipelineState> {
        let raw = fs::read_to_string(&self.state_path)
            .with_context(|| format!("failed to read {}", self.state_path.display()))?;
        serde_json::from_str(&raw)
            .with_context(|| format!("failed to parse {}", self.state_path.display()))
    }

    fn write_state_blocking(&self, state: PipelineState) -> Result<()> {
        let raw =
            serde_json::to_string_pretty(&state).context("failed to serialize pipeline state")?;
        fs::write(&self.state_path, raw)
            .with_context(|| format!("failed to write {}", self.state_path.display()))
    }
}

impl PipelineStage {
    pub(crate) fn debug_path(&self) -> &Path {
        &self.debug_path
    }

    pub(crate) async fn append_debug(&self, message: &str) -> Result<()> {
        let stage = self.clone_for_async();
        let message = message.to_string();
        run_blocking_io("append stage debug", move || {
            stage.append_debug_blocking(&message)
        })
        .await
    }

    pub(crate) async fn finish_ok(self, message: &str) -> Result<()> {
        let message = message.to_string();
        run_blocking_io("finish stage success", move || {
            self.finish_ok_blocking(&message)
        })
        .await
    }

    pub(crate) async fn finish_error(self, message: &str) -> Result<()> {
        let message = message.to_string();
        run_blocking_io("finish stage error", move || {
            self.finish_error_blocking(&message)
        })
        .await
    }

    fn clone_for_async(&self) -> Self {
        Self {
            task_kind: self.task_kind,
            task_id: self.task_id.clone(),
            stage_name: self.stage_name,
            summary_path: self.summary_path.clone(),
            event_path: self.event_path.clone(),
            debug_path: self.debug_path.clone(),
            started_at: self.started_at,
        }
    }

    fn append_debug_blocking(&self, message: &str) -> Result<()> {
        append_log_blocking(&self.debug_path, message)
    }

    fn finish_ok_blocking(self, message: &str) -> Result<()> {
        append_log_blocking(
            &self.summary_path,
            &format!(
                "  -> {} succeeded in {}s: {}\n",
                self.stage_name.as_str(),
                self.started_at.elapsed().as_secs(),
                message
            ),
        )?;
        append_task_event_blocking(
            &self.event_path,
            self.task_kind,
            &self.task_id,
            TaskEventType::StageSucceeded,
            serde_json::json!({
                "stage_name": self.stage_name,
                "debug_log_path": path_to_string(&self.debug_path),
                "message": message,
                "duration_seconds": self.started_at.elapsed().as_secs(),
            }),
        )?;
        self.update_state_after_finish(TaskStatus::Succeeded, message)
    }

    fn finish_error_blocking(self, message: &str) -> Result<()> {
        append_log_blocking(
            &self.summary_path,
            &format!(
                "  -> {} failed in {}s: {}\n",
                self.stage_name.as_str(),
                self.started_at.elapsed().as_secs(),
                message
            ),
        )?;
        append_log_blocking(
            &self.summary_path,
            &format!("     debug: {}\n", self.debug_path.display()),
        )?;
        append_debug_tail_to_summary(
            &self.summary_path,
            &self.debug_path,
            FAILURE_DEBUG_TAIL_LINES,
        )?;
        append_task_event_blocking(
            &self.event_path,
            self.task_kind,
            &self.task_id,
            TaskEventType::StageFailed,
            serde_json::json!({
                "stage_name": self.stage_name,
                "debug_log_path": path_to_string(&self.debug_path),
                "message": message,
                "duration_seconds": self.started_at.elapsed().as_secs(),
            }),
        )?;
        self.update_state_after_finish(TaskStatus::Failed, message)
    }

    fn update_state_after_finish(self, status: TaskStatus, message: &str) -> Result<()> {
        let mut state = read_pipeline_state(
            &self.summary_path,
            &self.event_path,
            &self.task_id,
            self.task_kind,
        )?;
        for stage in &mut state.stages {
            if stage.name == self.stage_name {
                stage.status = status;
                stage.finished_at = Some(Utc::now().to_rfc3339());
                stage.duration_seconds = Some(self.started_at.elapsed().as_secs());
                stage.result_message = Some(message.to_string());
            }
        }
        state.current_stage = None;
        if status == TaskStatus::Failed {
            state.status = TaskStatus::Failed;
            state.failed_stage = Some(self.stage_name);
            state.failure_kind = Some(self.stage_name.failure_kind());
            state.last_error = Some(message.to_string());
        }
        state.updated_at = Utc::now().to_rfc3339();
        write_pipeline_state(
            &self.summary_path,
            &self.event_path,
            &self.task_id,
            self.task_kind,
            state,
        )
    }
}

fn ensure_data_dirs_blocking(data_dir: &Path) -> Result<()> {
    for relative in [
        "archives",
        "buildx-config",
        "events/builds",
        "events/deployments",
        "logs/builds",
        "logs/deployments",
        "iids",
        "pipelines/builds",
        "pipelines/deployments",
        "runtime-env",
        "sources",
    ] {
        fs::create_dir_all(data_dir.join(relative))
            .with_context(|| format!("failed to create {}", data_dir.join(relative).display()))?;
    }

    Ok(())
}

fn prepare_log_blocking(log_path: &Path, header: &str) -> Result<()> {
    if let Some(parent) = log_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }

    fs::write(
        log_path,
        format!("{}\n{}\n\n", Utc::now().to_rfc3339(), header),
    )
    .with_context(|| format!("failed to create log {}", log_path.display()))?;

    Ok(())
}

fn append_log_blocking(log_path: &Path, message: &str) -> Result<()> {
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .with_context(|| format!("failed to open log {}", log_path.display()))?;
    file.write_all(message.as_bytes())
        .with_context(|| format!("failed to write log {}", log_path.display()))?;
    Ok(())
}

fn append_task_event_blocking(
    event_path: &Path,
    task_kind: TaskKind,
    task_id: &str,
    event_type: TaskEventType,
    details: Value,
) -> Result<()> {
    if let Some(parent) = event_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }

    let event = TaskEvent {
        at: Utc::now().to_rfc3339(),
        task_kind,
        task_id,
        event_type,
        details,
    };
    let line = serde_json::to_string(&event).context("failed to serialize task event")?;

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(event_path)
        .with_context(|| format!("failed to open event log {}", event_path.display()))?;
    file.write_all(line.as_bytes())
        .with_context(|| format!("failed to write event log {}", event_path.display()))?;
    file.write_all(b"\n")
        .with_context(|| format!("failed to write event log {}", event_path.display()))?;
    Ok(())
}

fn append_debug_tail_to_summary(
    summary_path: &Path,
    debug_path: &Path,
    max_lines: usize,
) -> Result<()> {
    let lines = read_tail_lines(debug_path, max_lines)?;
    append_log_blocking(summary_path, "     recent debug tail:\n")?;
    for line in lines {
        append_log_blocking(summary_path, &format!("       {}\n", line))?;
    }
    Ok(())
}

fn upsert_stage_state(stages: &mut Vec<PipelineStageState>, next: PipelineStageState) {
    if let Some(existing) = stages.iter_mut().find(|stage| stage.name == next.name) {
        *existing = next;
        return;
    }
    stages.push(next);
    stages.sort_by_key(|stage| stage.order);
}

fn duration_seconds_from_state(state: &PipelineState) -> Option<u64> {
    let started_at = DateTime::parse_from_rfc3339(&state.started_at).ok()?;
    let finished_at = state
        .finished_at
        .as_deref()
        .and_then(|value| DateTime::parse_from_rfc3339(value).ok())?;
    let elapsed = finished_at.signed_duration_since(started_at);
    u64::try_from(elapsed.num_seconds()).ok()
}

fn state_path_from_summary_path(summary_path: &Path) -> Result<PathBuf> {
    let parent = summary_path
        .parent()
        .with_context(|| format!("summary path {} has no parent", summary_path.display()))?;
    Ok(parent.join("state.json"))
}

fn read_pipeline_state(
    summary_path: &Path,
    event_path: &Path,
    task_id: &str,
    task_kind: TaskKind,
) -> Result<PipelineState> {
    let state_path = state_path_from_summary_path(summary_path)?;
    let raw = fs::read_to_string(&state_path)
        .with_context(|| format!("failed to read {}", state_path.display()))?;
    let mut state: PipelineState = serde_json::from_str(&raw)
        .with_context(|| format!("failed to parse {}", state_path.display()))?;
    if state.summary_log_path.is_empty() {
        state.summary_log_path = path_to_string(summary_path);
    }
    if state.event_log_path.is_empty() {
        state.event_log_path = path_to_string(event_path);
    }
    if state.task_id.is_empty() {
        state.task_id = task_id.to_string();
    }
    if state.started_at.is_empty() {
        state.started_at = Utc::now().to_rfc3339();
    }
    if state.failure_kind.is_none() && state.status == TaskStatus::Failed {
        state.failure_kind = Some(task_kind.fallback_failure_kind());
    }
    Ok(state)
}

fn write_pipeline_state(
    summary_path: &Path,
    _event_path: &Path,
    _task_id: &str,
    _task_kind: TaskKind,
    state: PipelineState,
) -> Result<()> {
    let state_path = state_path_from_summary_path(summary_path)?;
    let raw = serde_json::to_string_pretty(&state).context("failed to serialize pipeline state")?;
    fs::write(&state_path, raw).with_context(|| format!("failed to write {}", state_path.display()))
}

fn read_task_snapshot_blocking(
    data_dir: &Path,
    task_kind: TaskKind,
    task_id: &str,
) -> Result<TaskSnapshot> {
    let summary_path = match task_kind {
        TaskKind::Build => build_log_path(data_dir, task_id),
        TaskKind::Deployment => deployment_log_path(data_dir, task_id),
    };
    let event_path = match task_kind {
        TaskKind::Build => build_event_path(data_dir, task_id),
        TaskKind::Deployment => deployment_event_path(data_dir, task_id),
    };

    let state = match read_pipeline_state(&summary_path, &event_path, task_id, task_kind) {
        Ok(state) => state,
        Err(pipeline_error) => {
            return read_legacy_task_snapshot(data_dir, task_kind, task_id).with_context(|| {
                format!(
                    "failed to read pipeline snapshot and legacy snapshot for {} {}: {}",
                    task_kind.as_str(),
                    task_id,
                    pipeline_error
                )
            })
        }
    };

    let recent_summary_lines = read_tail_lines(
        Path::new(&state.summary_log_path),
        SNAPSHOT_SUMMARY_TAIL_LINES,
    )?;
    let recent_events =
        read_event_tail(Path::new(&state.event_log_path), SNAPSHOT_EVENT_TAIL_LINES)?;
    let debug_tails = collect_debug_tails(&state)?;

    Ok(TaskSnapshot {
        task_kind: state.task_kind,
        task_id: state.task_id,
        status: state.status,
        current_stage: state.current_stage,
        failed_stage: state.failed_stage,
        failure_kind: state.failure_kind,
        last_error: state.last_error,
        summary_log_path: state.summary_log_path,
        event_log_path: state.event_log_path,
        started_at: state.started_at,
        finished_at: state.finished_at,
        duration_seconds: state.duration_seconds,
        stages: state.stages,
        recent_summary_lines,
        recent_events,
        debug_tails,
    })
}

fn read_tail_lines(path: &Path, max_lines: usize) -> Result<Vec<String>> {
    if max_lines == 0 {
        return Ok(Vec::new());
    }

    let mut file =
        File::open(path).with_context(|| format!("failed to read {}", path.display()))?;
    let file_len = file
        .metadata()
        .with_context(|| format!("failed to stat {}", path.display()))?
        .len();
    if file_len == 0 {
        return Ok(Vec::new());
    }

    let mut position = file_len;
    let mut newline_count = 0usize;
    let mut chunks = Vec::new();

    while position > 0 && newline_count <= max_lines {
        let read_len = TAIL_READ_CHUNK_BYTES.min(position as usize);
        position -= read_len as u64;
        file.seek(SeekFrom::Start(position))
            .with_context(|| format!("failed to seek {}", path.display()))?;
        let mut chunk = vec![0; read_len];
        file.read_exact(&mut chunk)
            .with_context(|| format!("failed to read {}", path.display()))?;
        newline_count += chunk.iter().filter(|&&byte| byte == b'\n').count();
        chunks.push(chunk);
    }

    chunks.reverse();
    let capacity = chunks.iter().map(Vec::len).sum();
    let mut buffer = Vec::with_capacity(capacity);
    for chunk in chunks {
        buffer.extend_from_slice(&chunk);
    }

    let mut content = String::from_utf8_lossy(&buffer).into_owned();
    if position > 0 {
        if let Some(index) = content.find('\n') {
            content = content[index + 1..].to_string();
        } else {
            content.clear();
        }
    }

    let lines = content.lines().map(str::to_string).collect::<Vec<_>>();
    let start = lines.len().saturating_sub(max_lines);
    Ok(lines[start..].to_vec())
}

fn read_event_tail(path: &Path, max_lines: usize) -> Result<Vec<Value>> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let mut events = Vec::new();
    for line in read_tail_lines(path, max_lines)? {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let parsed = serde_json::from_str::<Value>(trimmed)
            .with_context(|| format!("failed to parse event line from {}", path.display()))?;
        events.push(parsed);
    }
    Ok(events)
}

fn collect_debug_tails(state: &PipelineState) -> Result<Vec<TaskDebugTail>> {
    let mut stage_names = Vec::new();
    if let Some(current_stage) = state.current_stage {
        stage_names.push(current_stage);
    }
    if let Some(failed_stage) = state.failed_stage {
        if !stage_names.iter().any(|stage| *stage == failed_stage) {
            stage_names.push(failed_stage);
        }
    }

    let mut tails = Vec::new();
    for stage_name in stage_names {
        let Some(stage) = state.stages.iter().find(|item| item.name == stage_name) else {
            continue;
        };
        let lines = read_tail_lines(Path::new(&stage.debug_log_path), FAILURE_DEBUG_TAIL_LINES)?;
        tails.push(TaskDebugTail {
            stage_name,
            debug_log_path: stage.debug_log_path.clone(),
            lines,
        });
    }

    if tails.is_empty() && state.status == TaskStatus::Failed && state.last_error.is_some() {
        tails.push(TaskDebugTail {
            stage_name: TaskStage::Task,
            debug_log_path: state.summary_log_path.clone(),
            lines: read_tail_lines(Path::new(&state.summary_log_path), FAILURE_DEBUG_TAIL_LINES)?,
        });
    }

    Ok(tails)
}

fn read_legacy_task_snapshot(
    data_dir: &Path,
    task_kind: TaskKind,
    task_id: &str,
) -> Result<TaskSnapshot> {
    let legacy_log_path = match task_kind {
        TaskKind::Build => data_dir
            .join("logs")
            .join("builds")
            .join(format!("{}.log", task_id)),
        TaskKind::Deployment => data_dir
            .join("logs")
            .join("deployments")
            .join(format!("{}.log", task_id)),
    };

    let recent_summary_lines = read_tail_lines(&legacy_log_path, SNAPSHOT_SUMMARY_TAIL_LINES)?;
    let started_at = fs::metadata(&legacy_log_path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .map(|time| chrono::DateTime::<Utc>::from(time).to_rfc3339())
        .unwrap_or_else(|| Utc::now().to_rfc3339());

    Ok(TaskSnapshot {
        task_kind,
        task_id: task_id.to_string(),
        status: TaskStatus::Legacy,
        current_stage: None,
        failed_stage: None,
        failure_kind: None,
        last_error: None,
        summary_log_path: path_to_string(&legacy_log_path),
        event_log_path: String::new(),
        started_at,
        finished_at: None,
        duration_seconds: None,
        stages: Vec::new(),
        recent_summary_lines,
        recent_events: Vec::new(),
        debug_tails: Vec::new(),
    })
}

async fn run_blocking_io<T, F>(label: &'static str, operation: F) -> Result<T>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T> + Send + 'static,
{
    spawn_blocking(operation)
        .await
        .with_context(|| format!("{} join failed", label))?
}
