-- Migration: Add chat-linkage schema for automation runs ↔ conversations
-- Issue: #255
--
-- Adds:
--   1. app.conversation_source enum ('chat', 'automation_run')
--   2. app.conversations.source + source_metadata columns
--   3. app.automation_runs.chat_conversation_id, chat_tab_id, chat_request_id columns
--   4. Indexes for efficient lookups
--
-- Backward-compatible: linkage columns are nullable, conversations.source defaults to 'chat'.

BEGIN;

-- 1. Create conversation source enum
CREATE TYPE app.conversation_source AS ENUM ('chat', 'automation_run');

-- 2. Add source columns to conversations
ALTER TABLE app.conversations
  ADD COLUMN source app.conversation_source NOT NULL DEFAULT 'chat',
  ADD COLUMN source_metadata jsonb;

COMMENT ON COLUMN app.conversations.source IS 'Origin of this conversation: user chat or automation run';
COMMENT ON COLUMN app.conversations.source_metadata IS 'Extra context about the source (e.g. automation job_id, run_id)';

-- 3. Add chat-linkage columns to automation_runs
ALTER TABLE app.automation_runs
  ADD COLUMN chat_conversation_id text,
  ADD COLUMN chat_tab_id text,
  ADD COLUMN chat_request_id text;

COMMENT ON COLUMN app.automation_runs.chat_conversation_id IS 'FK to app.conversations — the conversation created for this run';
COMMENT ON COLUMN app.automation_runs.chat_tab_id IS 'Tab ID within the conversation';
COMMENT ON COLUMN app.automation_runs.chat_request_id IS 'Unique request ID for the Claude stream call';

-- 4. Foreign key: automation_runs.chat_conversation_id → conversations.conversation_id
ALTER TABLE app.automation_runs
  ADD CONSTRAINT automation_runs_chat_conversation_id_fkey
    FOREIGN KEY (chat_conversation_id)
    REFERENCES app.conversations(conversation_id)
    ON DELETE SET NULL;

-- 5. Indexes
CREATE INDEX idx_automation_runs_chat_conversation
  ON app.automation_runs (chat_conversation_id)
  WHERE chat_conversation_id IS NOT NULL;

CREATE INDEX idx_conversations_source
  ON app.conversations (source)
  WHERE source != 'chat';

COMMIT;
