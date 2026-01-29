-- Migration: Rename conversation_id to tab_id in iam.sessions
-- Date: 2026-01-27
-- PR: tab_convo_migration PR 7
-- Purpose: Column stores tabId (Claude SDK session key per browser tab), not conversationId

BEGIN;

-- Rename the column
ALTER TABLE iam.sessions RENAME COLUMN conversation_id TO tab_id;

-- Drop old unique constraint
ALTER TABLE iam.sessions DROP CONSTRAINT IF EXISTS sessions_user_id_domain_id_conversation_id_key;

-- Add new unique constraint
ALTER TABLE iam.sessions ADD CONSTRAINT sessions_user_id_domain_id_tab_id_key
  UNIQUE (user_id, domain_id, tab_id);

COMMIT;
