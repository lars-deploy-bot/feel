-- =============================================================================
-- Migration 0019: Drop org_id from automation_jobs
--
-- The org_id column was redundant — always derivable via site_id → domains.org_id.
-- All application code now joins through domains to get the org.
--
-- Applied: 2026-03-08 (staging + production)
-- =============================================================================

-- Drop enforcement triggers (if they exist from earlier migration attempt)
DROP TRIGGER IF EXISTS trg_enforce_automation_job_org_id ON app.automation_jobs;
DROP TRIGGER IF EXISTS trg_cascade_domain_org_to_jobs ON app.domains;
DROP FUNCTION IF EXISTS app.enforce_automation_job_org_id();
DROP FUNCTION IF EXISTS app.cascade_domain_org_to_jobs();

-- Drop FK, index, and column
ALTER TABLE app.automation_jobs DROP CONSTRAINT IF EXISTS automation_jobs_org_id_fkey;
DROP INDEX IF EXISTS app.idx_automation_jobs_org_id;
ALTER TABLE app.automation_jobs DROP COLUMN IF EXISTS org_id;
