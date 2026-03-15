-- Add 'paused' to sandbox_status enum
-- This value was added to staging manually; this migration codifies it.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'paused'
      AND enumtypid = 'app.sandbox_status'::regtype
  ) THEN
    ALTER TYPE app.sandbox_status ADD VALUE 'paused' AFTER 'running';
  END IF;
END
$$;
