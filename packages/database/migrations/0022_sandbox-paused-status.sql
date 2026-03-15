-- Add 'paused' to sandbox_status enum for E2B lifecycle pause/resume support.
-- Paused sandboxes auto-resume on Sandbox.connect() — no data loss.
ALTER TYPE app.sandbox_status ADD VALUE IF NOT EXISTS 'paused' AFTER 'running';
