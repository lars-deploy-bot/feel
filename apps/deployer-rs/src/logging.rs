use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Instant;

use anyhow::{Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::process::Command;

use crate::types::{TaskEvent, TaskKind};

const FAILURE_DEBUG_TAIL_LINES: usize = 80;

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
    stage_name: String,
    summary_path: PathBuf,
    event_path: PathBuf,
    debug_path: PathBuf,
    started_at: Instant,
}

#[derive(Serialize, Deserialize)]
struct PipelineState {
    task_kind: String,
    task_id: String,
    status: String,
    current_stage: Option<String>,
    failed_stage: Option<String>,
    last_error: Option<String>,
    summary_log_path: String,
    event_log_path: String,
    updated_at: String,
    stages: Vec<PipelineStageState>,
}

#[derive(Serialize, Deserialize)]
struct PipelineStageState {
    order: u8,
    name: String,
    status: String,
    summary_message: String,
    debug_log_path: String,
    started_at: Option<String>,
    finished_at: Option<String>,
    duration_seconds: Option<u64>,
    result_message: Option<String>,
}

pub(crate) fn ensure_data_dirs(data_dir: &Path) -> Result<()> {
    for relative in [
        "archives",
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

pub(crate) fn prepare_log(log_path: &Path, header: &str) -> Result<()> {
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

pub(crate) fn append_log(log_path: &Path, message: &str) -> Result<()> {
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .with_context(|| format!("failed to open log {}", log_path.display()))?;
    file.write_all(message.as_bytes())
        .with_context(|| format!("failed to write log {}", log_path.display()))?;
    Ok(())
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

pub(crate) fn append_task_event(
    event_path: &Path,
    task_kind: TaskKind,
    task_id: &str,
    event_type: &str,
    details: Value,
) -> Result<()> {
    if let Some(parent) = event_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }

    let task_kind_label = match task_kind {
        TaskKind::Build => "build",
        TaskKind::Deployment => "deployment",
    };
    let event = TaskEvent {
        at: Utc::now().to_rfc3339(),
        task_kind: task_kind_label,
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

pub(crate) async fn run_logged_command(
    mut command: Command,
    log_path: &Path,
    description: &str,
) -> Result<()> {
    append_log(log_path, &format!("$ {}\n", description))?;

    let stdout = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .with_context(|| format!("failed to open {}", log_path.display()))?;
    let stderr = stdout
        .try_clone()
        .with_context(|| format!("failed to clone {}", log_path.display()))?;

    command.stdout(Stdio::from(stdout));
    command.stderr(Stdio::from(stderr));

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

    append_log(log_path, "\n")?;
    Ok(())
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

    pub(crate) fn prepare(&self, header: &str) -> Result<()> {
        if let Some(parent) = self.summary_path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("failed to create {}", parent.display()))?;
        }
        fs::create_dir_all(&self.stages_dir)
            .with_context(|| format!("failed to create {}", self.stages_dir.display()))?;
        prepare_log(&self.summary_path, header)?;
        self.write_state(PipelineState {
            task_kind: task_kind_label(self.task_kind).to_string(),
            task_id: self.task_id.clone(),
            status: "running".to_string(),
            current_stage: None,
            failed_stage: None,
            last_error: None,
            summary_log_path: path_to_string(&self.summary_path),
            event_log_path: path_to_string(&self.event_path),
            updated_at: Utc::now().to_rfc3339(),
            stages: Vec::new(),
        })
    }

    pub(crate) fn summary_path(&self) -> &Path {
        &self.summary_path
    }

    pub(crate) fn append_summary(&self, message: &str) -> Result<()> {
        append_log(&self.summary_path, message)
    }

    pub(crate) fn emit(&self, event_type: &str, details: Value) -> Result<()> {
        append_task_event(
            &self.event_path,
            self.task_kind,
            &self.task_id,
            event_type,
            details,
        )
    }

    pub(crate) fn start_stage(
        &self,
        order: u8,
        stage_name: &str,
        summary_message: &str,
    ) -> Result<PipelineStage> {
        let debug_path = self.stages_dir.join(format!(
            "{:02}-{}.log",
            order,
            slugify_stage_name(stage_name)
        ));
        prepare_log(&debug_path, &format!("stage {} started", stage_name))?;
        append_log(
            &self.summary_path,
            &format!(
                "[{:02}] {}: {} (debug: {})\n",
                order,
                stage_name,
                summary_message,
                debug_path.display()
            ),
        )?;
        append_task_event(
            &self.event_path,
            self.task_kind,
            &self.task_id,
            "stage_started",
            serde_json::json!({
                "stage_name": stage_name,
                "stage_order": order,
                "debug_log_path": path_to_string(&debug_path),
                "message": summary_message,
            }),
        )?;
        let mut state = self.read_state()?;
        upsert_stage_state(
            &mut state.stages,
            PipelineStageState {
                order,
                name: stage_name.to_string(),
                status: "running".to_string(),
                summary_message: summary_message.to_string(),
                debug_log_path: path_to_string(&debug_path),
                started_at: Some(Utc::now().to_rfc3339()),
                finished_at: None,
                duration_seconds: None,
                result_message: None,
            },
        );
        state.current_stage = Some(stage_name.to_string());
        state.updated_at = Utc::now().to_rfc3339();
        self.write_state(state)?;

        Ok(PipelineStage {
            task_kind: self.task_kind,
            task_id: self.task_id.clone(),
            stage_name: stage_name.to_string(),
            summary_path: self.summary_path.clone(),
            event_path: self.event_path.clone(),
            debug_path,
            started_at: Instant::now(),
        })
    }

    pub(crate) fn finish_success(&self, message: &str) -> Result<()> {
        let mut state = self.read_state()?;
        state.status = "succeeded".to_string();
        state.current_stage = None;
        state.last_error = None;
        state.updated_at = Utc::now().to_rfc3339();
        self.write_state(state)?;
        self.append_summary(&format!("task succeeded: {}\n", message))
    }

    pub(crate) fn finish_failure(&self, message: &str) -> Result<()> {
        let mut state = self.read_state()?;
        state.status = "failed".to_string();
        state.current_stage = None;
        state.last_error = Some(message.to_string());
        state.updated_at = Utc::now().to_rfc3339();
        self.write_state(state)?;
        self.append_summary(&format!("task failed: {}\n", message))
    }

    fn read_state(&self) -> Result<PipelineState> {
        let raw = fs::read_to_string(&self.state_path)
            .with_context(|| format!("failed to read {}", self.state_path.display()))?;
        serde_json::from_str(&raw)
            .with_context(|| format!("failed to parse {}", self.state_path.display()))
    }

    fn write_state(&self, state: PipelineState) -> Result<()> {
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

    pub(crate) fn append_debug(&self, message: &str) -> Result<()> {
        append_log(&self.debug_path, message)
    }

    pub(crate) fn finish_ok(self, message: &str) -> Result<()> {
        append_log(
            &self.summary_path,
            &format!(
                "  -> {} succeeded in {}s: {}\n",
                self.stage_name,
                self.started_at.elapsed().as_secs(),
                message
            ),
        )?;
        append_task_event(
            &self.event_path,
            self.task_kind,
            &self.task_id,
            "stage_succeeded",
            serde_json::json!({
                "stage_name": self.stage_name,
                "debug_log_path": path_to_string(&self.debug_path),
                "message": message,
                "duration_seconds": self.started_at.elapsed().as_secs(),
            }),
        )?;
        self.update_state_after_finish("succeeded", message)
    }

    pub(crate) fn finish_error(self, message: &str) -> Result<()> {
        append_log(
            &self.summary_path,
            &format!(
                "  -> {} failed in {}s: {}\n",
                self.stage_name,
                self.started_at.elapsed().as_secs(),
                message
            ),
        )?;
        append_log(
            &self.summary_path,
            &format!("     debug: {}\n", self.debug_path.display()),
        )?;
        append_debug_tail_to_summary(
            &self.summary_path,
            &self.debug_path,
            FAILURE_DEBUG_TAIL_LINES,
        )?;
        append_task_event(
            &self.event_path,
            self.task_kind,
            &self.task_id,
            "stage_failed",
            serde_json::json!({
                "stage_name": self.stage_name,
                "debug_log_path": path_to_string(&self.debug_path),
                "message": message,
                "duration_seconds": self.started_at.elapsed().as_secs(),
            }),
        )?;
        self.update_state_after_finish("failed", message)
    }

    fn update_state_after_finish(self, status: &str, message: &str) -> Result<()> {
        let mut state = read_pipeline_state(
            &self.summary_path,
            &self.event_path,
            &self.task_id,
            self.task_kind,
        )?;
        for stage in &mut state.stages {
            if stage.name == self.stage_name {
                stage.status = status.to_string();
                stage.finished_at = Some(Utc::now().to_rfc3339());
                stage.duration_seconds = Some(self.started_at.elapsed().as_secs());
                stage.result_message = Some(message.to_string());
            }
        }
        state.current_stage = None;
        if status == "failed" {
            state.status = "failed".to_string();
            state.failed_stage = Some(self.stage_name.clone());
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

fn append_debug_tail_to_summary(
    summary_path: &Path,
    debug_path: &Path,
    max_lines: usize,
) -> Result<()> {
    let content = fs::read_to_string(debug_path)
        .with_context(|| format!("failed to read debug log {}", debug_path.display()))?;
    let lines = content.lines().collect::<Vec<_>>();
    let start = lines.len().saturating_sub(max_lines);
    append_log(summary_path, "     recent debug tail:\n")?;
    for line in &lines[start..] {
        append_log(summary_path, &format!("       {}\n", line))?;
    }
    Ok(())
}

fn slugify_stage_name(stage_name: &str) -> String {
    let mut slug = String::with_capacity(stage_name.len());
    let mut previous_was_dash = false;
    for character in stage_name.chars() {
        let next = if character.is_ascii_alphanumeric() {
            character.to_ascii_lowercase()
        } else {
            '-'
        };
        if next == '-' {
            if previous_was_dash {
                continue;
            }
            previous_was_dash = true;
        } else {
            previous_was_dash = false;
        }
        slug.push(next);
    }
    slug.trim_matches('-').to_string()
}

fn task_kind_label(task_kind: TaskKind) -> &'static str {
    match task_kind {
        TaskKind::Build => "build",
        TaskKind::Deployment => "deployment",
    }
}

fn upsert_stage_state(stages: &mut Vec<PipelineStageState>, next: PipelineStageState) {
    if let Some(existing) = stages.iter_mut().find(|stage| stage.name == next.name) {
        *existing = next;
        return;
    }
    stages.push(next);
    stages.sort_by_key(|stage| stage.order);
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
    if state.task_id.is_empty() {
        state.task_id = task_id.to_string();
    }
    if state.task_kind.is_empty() {
        state.task_kind = task_kind_label(task_kind).to_string();
    }
    if state.summary_log_path.is_empty() {
        state.summary_log_path = path_to_string(summary_path);
    }
    if state.event_log_path.is_empty() {
        state.event_log_path = path_to_string(event_path);
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
