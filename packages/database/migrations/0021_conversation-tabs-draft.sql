-- Add per-tab draft state used by Dexie/server conversation sync.
-- This was added to the TypeScript schema in commit 8201be55 but the SQL
-- migration was missing, causing staging to drift and /api/conversations to
-- fail when selecting conversation_tabs.draft.

ALTER TABLE app.conversation_tabs
ADD COLUMN IF NOT EXISTS draft jsonb;
