-- Add avatar_url column to automation_jobs for custom agent avatars
ALTER TABLE app.automation_jobs
  ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN app.automation_jobs.avatar_url IS 'Custom avatar image URL generated via /api/manager/avatars/generate';
