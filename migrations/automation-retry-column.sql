-- Add consecutive_failures column for retry tracking
-- This column tracks how many times a job has failed in a row
-- Used by CronService for exponential backoff and auto-disable

ALTER TABLE app.automation_jobs
ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0;

COMMENT ON COLUMN app.automation_jobs.consecutive_failures IS
  'Number of consecutive failures. Reset to 0 on success. Job disabled after max retries.';
