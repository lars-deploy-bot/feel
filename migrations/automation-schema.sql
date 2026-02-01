-- Automation Schema for Scheduled Tasks
-- RFC: RFC-2026-005 (Scheduled Automation for Sites)
--
-- Enables users to schedule automated tasks for their sites:
-- - Cron-based scheduling (daily/weekly/monthly)
-- - One-time scheduled tasks
-- - Webhook-triggered automation
--
-- Uses the 'app' schema where domains and related tables live
-- NOTE: All IDs are TEXT with prefixes (dom_, user_, org_, auto_job_, auto_run_)

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE app.automation_trigger_type AS ENUM ('cron', 'webhook', 'one-time');
CREATE TYPE app.automation_action_type AS ENUM ('prompt', 'sync', 'publish');
CREATE TYPE app.automation_run_status AS ENUM ('pending', 'running', 'success', 'failure', 'skipped');

-- =============================================================================
-- AUTOMATION JOBS TABLE
-- =============================================================================

-- Main table for automation job definitions
CREATE TABLE app.automation_jobs (
    id TEXT PRIMARY KEY DEFAULT gen_prefixed_id('auto_job_'),

    -- Ownership (TEXT IDs matching existing schema)
    site_id TEXT NOT NULL REFERENCES app.domains(domain_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES iam.users(user_id) ON DELETE CASCADE,
    org_id TEXT NOT NULL REFERENCES iam.orgs(org_id) ON DELETE CASCADE,

    -- Job metadata
    name TEXT NOT NULL,
    description TEXT,

    -- Trigger configuration
    trigger_type app.automation_trigger_type NOT NULL,
    cron_schedule TEXT,           -- Cron expression (e.g., '0 6 * * *' for 6am daily)
    cron_timezone TEXT,           -- Timezone for cron (e.g., 'Europe/Amsterdam')
    run_at TIMESTAMPTZ,           -- For one-time jobs
    webhook_secret TEXT,          -- Secret for webhook authentication

    -- Action configuration
    action_type app.automation_action_type NOT NULL,
    action_prompt TEXT,           -- For 'prompt' type
    action_source JSONB,          -- For 'sync' type: external data source config
    action_target_page TEXT,      -- Target page path (e.g., '/events')
    action_format_prompt TEXT,    -- Optional custom formatting prompt for sync
    action_model TEXT,            -- Optional model override
    action_timeout_seconds INT DEFAULT 300,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    delete_after_run BOOLEAN DEFAULT FALSE,  -- For one-time jobs

    -- Runtime state (denormalized for quick queries)
    last_run_at TIMESTAMPTZ,
    last_run_status app.automation_run_status,
    last_run_error TEXT,
    last_run_duration_ms INT,
    next_run_at TIMESTAMPTZ,
    running_at TIMESTAMPTZ,       -- If currently running, when it started

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraints
ALTER TABLE app.automation_jobs
    ADD CONSTRAINT chk_cron_schedule
    CHECK (trigger_type != 'cron' OR cron_schedule IS NOT NULL);

ALTER TABLE app.automation_jobs
    ADD CONSTRAINT chk_one_time_run_at
    CHECK (trigger_type != 'one-time' OR run_at IS NOT NULL);

ALTER TABLE app.automation_jobs
    ADD CONSTRAINT chk_prompt_action
    CHECK (action_type != 'prompt' OR action_prompt IS NOT NULL);

-- =============================================================================
-- AUTOMATION RUNS TABLE
-- =============================================================================

-- Execution history for automation jobs
CREATE TABLE app.automation_runs (
    id TEXT PRIMARY KEY DEFAULT gen_prefixed_id('auto_run_'),
    job_id TEXT NOT NULL REFERENCES app.automation_jobs(id) ON DELETE CASCADE,

    -- Execution timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INT,

    -- Status
    status app.automation_run_status NOT NULL DEFAULT 'pending',

    -- Results
    result JSONB,                 -- Action-specific result data
    error TEXT,                   -- Error message if failed
    changes_made TEXT[],          -- List of files modified

    -- Context
    triggered_by TEXT,            -- 'scheduler', 'webhook', 'manual'
    trigger_context JSONB         -- Additional trigger info (webhook headers, etc.)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Jobs indexes
CREATE INDEX idx_automation_jobs_site_id ON app.automation_jobs(site_id);
CREATE INDEX idx_automation_jobs_user_id ON app.automation_jobs(user_id);
CREATE INDEX idx_automation_jobs_org_id ON app.automation_jobs(org_id);
CREATE INDEX idx_automation_jobs_is_active ON app.automation_jobs(is_active);
CREATE INDEX idx_automation_jobs_next_run ON app.automation_jobs(next_run_at)
    WHERE is_active = TRUE AND next_run_at IS NOT NULL;
CREATE INDEX idx_automation_jobs_trigger_type ON app.automation_jobs(trigger_type);

-- Runs indexes
CREATE INDEX idx_automation_runs_job_id ON app.automation_runs(job_id);
CREATE INDEX idx_automation_runs_started_at ON app.automation_runs(started_at DESC);
CREATE INDEX idx_automation_runs_status ON app.automation_runs(status);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION app.automation_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER automation_jobs_updated_at
    BEFORE UPDATE ON app.automation_jobs
    FOR EACH ROW EXECUTE FUNCTION app.automation_jobs_updated_at();

-- Auto-compute duration_ms on completion
CREATE OR REPLACE FUNCTION app.automation_runs_compute_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.completed_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
        NEW.duration_ms = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER automation_runs_compute_duration
    BEFORE UPDATE ON app.automation_runs
    FOR EACH ROW EXECUTE FUNCTION app.automation_runs_compute_duration();

-- =============================================================================
-- WEBHOOK SECRET GENERATION
-- =============================================================================

-- Generate webhook secret on insert for webhook-type jobs
CREATE OR REPLACE FUNCTION app.automation_jobs_generate_webhook_secret()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.trigger_type = 'webhook' AND NEW.webhook_secret IS NULL THEN
        NEW.webhook_secret = encode(gen_random_bytes(32), 'hex');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER automation_jobs_generate_webhook_secret
    BEFORE INSERT ON app.automation_jobs
    FOR EACH ROW EXECUTE FUNCTION app.automation_jobs_generate_webhook_secret();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE app.automation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.automation_runs ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for scheduler service)
CREATE POLICY "Service role full access to jobs"
    ON app.automation_jobs FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access to runs"
    ON app.automation_runs FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get all due jobs (for scheduler polling)
CREATE OR REPLACE FUNCTION app.get_due_automation_jobs()
RETURNS SETOF app.automation_jobs AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM app.automation_jobs
    WHERE is_active = TRUE
      AND running_at IS NULL
      AND next_run_at IS NOT NULL
      AND next_run_at <= NOW()
    ORDER BY next_run_at ASC
    FOR UPDATE SKIP LOCKED;  -- Prevent concurrent execution
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark job as started (atomic operation)
CREATE OR REPLACE FUNCTION app.start_automation_job(job_id_param TEXT)
RETURNS app.automation_jobs AS $$
DECLARE
    job app.automation_jobs;
BEGIN
    UPDATE app.automation_jobs
    SET running_at = NOW()
    WHERE id = job_id_param
      AND is_active = TRUE
      AND running_at IS NULL
    RETURNING * INTO job;

    IF job.id IS NULL THEN
        RAISE EXCEPTION 'Job not found or already running: %', job_id_param;
    END IF;

    RETURN job;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark job as finished and create run record
CREATE OR REPLACE FUNCTION app.finish_automation_job(
    job_id_param TEXT,
    status_param app.automation_run_status,
    error_param TEXT DEFAULT NULL,
    result_param JSONB DEFAULT NULL,
    changes_param TEXT[] DEFAULT NULL,
    next_run_param TIMESTAMPTZ DEFAULT NULL
)
RETURNS app.automation_runs AS $$
DECLARE
    job app.automation_jobs;
    run app.automation_runs;
    started_at_val TIMESTAMPTZ;
    duration_val INT;
BEGIN
    -- Get the job and its started time
    SELECT * INTO job FROM app.automation_jobs WHERE id = job_id_param;

    IF job.id IS NULL THEN
        RAISE EXCEPTION 'Job not found: %', job_id_param;
    END IF;

    started_at_val := COALESCE(job.running_at, NOW());
    duration_val := EXTRACT(EPOCH FROM (NOW() - started_at_val)) * 1000;

    -- Create run record
    INSERT INTO app.automation_runs (
        job_id, started_at, completed_at, duration_ms,
        status, error, result, changes_made, triggered_by
    ) VALUES (
        job_id_param, started_at_val, NOW(), duration_val,
        status_param, error_param, result_param, changes_param, 'scheduler'
    ) RETURNING * INTO run;

    -- Update job state
    UPDATE app.automation_jobs
    SET running_at = NULL,
        last_run_at = started_at_val,
        last_run_status = status_param,
        last_run_error = error_param,
        last_run_duration_ms = duration_val,
        next_run_at = next_run_param,
        -- Disable one-time jobs after success
        is_active = CASE
            WHEN trigger_type = 'one-time' AND status_param = 'success'
            THEN FALSE
            ELSE is_active
        END
    WHERE id = job_id_param;

    RETURN run;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON app.automation_jobs TO authenticated;
GRANT SELECT ON app.automation_runs TO authenticated;
GRANT ALL ON app.automation_jobs TO service_role;
GRANT ALL ON app.automation_runs TO service_role;
GRANT EXECUTE ON FUNCTION app.get_due_automation_jobs() TO service_role;
GRANT EXECUTE ON FUNCTION app.start_automation_job(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION app.finish_automation_job(TEXT, app.automation_run_status, TEXT, JSONB, TEXT[], TIMESTAMPTZ) TO service_role;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE app.automation_jobs IS 'Scheduled automation jobs for sites';
COMMENT ON TABLE app.automation_runs IS 'Execution history for automation jobs';
COMMENT ON COLUMN app.automation_jobs.cron_schedule IS 'Cron expression (e.g., "0 6 * * *" for 6am daily)';
COMMENT ON COLUMN app.automation_jobs.webhook_secret IS 'Auto-generated secret for webhook authentication';
COMMENT ON COLUMN app.automation_jobs.action_source IS 'External data source config (JSON): {type, connectionId, config}';
COMMENT ON COLUMN app.automation_jobs.running_at IS 'Set when job starts running, cleared when finished. Used to prevent concurrent execution.';
COMMENT ON FUNCTION app.get_due_automation_jobs() IS 'Returns jobs ready to run. Uses FOR UPDATE SKIP LOCKED for concurrent safety.';
