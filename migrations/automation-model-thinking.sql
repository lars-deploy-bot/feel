-- Add model and thinking columns for automation jobs
-- These enable per-job model selection and agent guidance

-- Model override column
ALTER TABLE app.automation_jobs
ADD COLUMN IF NOT EXISTS action_model TEXT;

COMMENT ON COLUMN app.automation_jobs.action_model IS
  'Optional model override (e.g., "claude-sonnet-4-20250514"). Uses default if null.';

-- Thinking/guidance prompt column
ALTER TABLE app.automation_jobs
ADD COLUMN IF NOT EXISTS action_thinking TEXT;

COMMENT ON COLUMN app.automation_jobs.action_thinking IS
  'Optional thinking/guidance prompt to help the agent approach the task.';

-- Consecutive failures tracking
ALTER TABLE app.automation_jobs
ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0;

COMMENT ON COLUMN app.automation_jobs.consecutive_failures IS
  'Number of consecutive failures. Reset to 0 on success. Job disabled after max retries.';
