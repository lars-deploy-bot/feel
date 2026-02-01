-- Migration: Create conversation sync tables
-- Date: 2026-02-01
-- Purpose: Enable full conversation sync between browser (Dexie) and server (Supabase)
--
-- Schema: app
-- Tables:
--   - conversations: Groups of chat tabs (what appears in sidebar)
--   - conversation_tabs: Individual chat tabs within a conversation
--   - messages: Chat messages within tabs
--
-- Design notes:
-- - Messages belong to tabs, not conversations directly
-- - Tabs belong to conversations (1:many)
-- - Conversations belong to users and workspaces
-- - Soft deletes only (deleted_at) to prevent multi-device desync
-- - Visibility: private (owner only) or shared (org members can view)

BEGIN;

-- ============================================================================
-- DROP OLD TABLE (empty, safe to drop)
-- ============================================================================

DROP TABLE IF EXISTS app.conversations CASCADE;

-- ============================================================================
-- CONVERSATIONS
-- A conversation is a group of tabs shown in the sidebar
-- ============================================================================

CREATE TABLE app.conversations (
  conversation_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Ownership (TEXT to match iam.users.user_id and iam.orgs.org_id)
  user_id TEXT NOT NULL REFERENCES iam.users(user_id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES iam.orgs(org_id) ON DELETE CASCADE,
  workspace TEXT NOT NULL,  -- e.g., "example.com" or "claude-bridge"

  -- Display
  title TEXT NOT NULL DEFAULT 'New conversation',
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared')),

  -- Metadata (denormalized for performance - avoid scanning messages)
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  first_user_message_id TEXT,  -- For auto-title generation
  auto_title_set BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Soft deletes
  deleted_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX idx_conversations_user_workspace ON app.conversations(user_id, workspace, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversations_org_shared ON app.conversations(org_id, visibility, updated_at DESC) WHERE deleted_at IS NULL AND visibility = 'shared';
CREATE INDEX idx_conversations_user_updated ON app.conversations(user_id, updated_at DESC) WHERE deleted_at IS NULL;

-- ============================================================================
-- CONVERSATION_TABS
-- Individual chat tabs within a conversation
-- ============================================================================

CREATE TABLE app.conversation_tabs (
  tab_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id TEXT NOT NULL REFERENCES app.conversations(conversation_id) ON DELETE CASCADE,

  -- Display
  name TEXT NOT NULL DEFAULT 'current',
  position INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Soft close (tab closed but can be reopened)
  closed_at TIMESTAMPTZ
);

-- Index for fetching tabs by conversation
CREATE INDEX idx_conversation_tabs_conversation ON app.conversation_tabs(conversation_id, position) WHERE closed_at IS NULL;

-- ============================================================================
-- MESSAGES
-- Chat messages within tabs
-- ============================================================================

CREATE TABLE app.messages (
  message_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tab_id TEXT NOT NULL REFERENCES app.conversation_tabs(tab_id) ON DELETE CASCADE,

  -- Message type
  type TEXT NOT NULL CHECK (type IN ('user', 'assistant', 'tool_use', 'tool_result', 'thinking', 'system', 'sdk_message')),

  -- Content (JSONB for flexibility)
  -- Discriminated union: { kind: 'text', text: '...' } | { kind: 'tool_use', ... } | etc.
  content JSONB NOT NULL,

  -- Ordering (seq is more reliable than timestamp for concurrent messages)
  seq INTEGER NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('streaming', 'complete', 'interrupted', 'error')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Optional metadata
  aborted_at TIMESTAMPTZ,
  error_code TEXT,

  -- Schema version for future migrations
  version INTEGER NOT NULL DEFAULT 1,

  -- Ensure unique ordering within tab
  UNIQUE (tab_id, seq)
);

-- Index for fetching messages by tab (ordered)
CREATE INDEX idx_messages_tab_seq ON app.messages(tab_id, seq);

-- Index for pagination (cursor-based using created_at)
CREATE INDEX idx_messages_tab_created ON app.messages(tab_id, created_at);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Uses public.sub() for user identification from JWT
-- Uses iam.is_org_member(org_id) for org membership checks

ALTER TABLE app.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.conversation_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.messages ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON app.conversations TO service_role;
GRANT ALL ON app.conversation_tabs TO service_role;
GRANT ALL ON app.messages TO service_role;

-- ============================================================================
-- CONVERSATIONS POLICIES
-- ============================================================================

-- Users can view their own conversations
CREATE POLICY "Users can view own conversations"
  ON app.conversations FOR SELECT
  USING (user_id = sub());

-- Users can view shared conversations in their org
CREATE POLICY "Users can view shared org conversations"
  ON app.conversations FOR SELECT
  USING (visibility = 'shared' AND iam.is_org_member(org_id));

-- Users can create conversations (only for themselves)
CREATE POLICY "Users can create own conversations"
  ON app.conversations FOR INSERT
  WITH CHECK (user_id = sub());

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations"
  ON app.conversations FOR UPDATE
  USING (user_id = sub())
  WITH CHECK (user_id = sub());

-- Users can delete their own conversations
CREATE POLICY "Users can delete own conversations"
  ON app.conversations FOR DELETE
  USING (user_id = sub());

-- ============================================================================
-- CONVERSATION_TABS POLICIES
-- ============================================================================

-- Users can view tabs for conversations they can access
CREATE POLICY "Users can view tabs"
  ON app.conversation_tabs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.conversations c
      WHERE c.conversation_id = conversation_tabs.conversation_id
      AND (c.user_id = sub() OR (c.visibility = 'shared' AND iam.is_org_member(c.org_id)))
    )
  );

-- Users can insert tabs for their own conversations
CREATE POLICY "Users can insert tabs"
  ON app.conversation_tabs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.conversations c
      WHERE c.conversation_id = conversation_tabs.conversation_id
      AND c.user_id = sub()
    )
  );

-- Users can update tabs for their own conversations
CREATE POLICY "Users can update tabs"
  ON app.conversation_tabs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM app.conversations c
      WHERE c.conversation_id = conversation_tabs.conversation_id
      AND c.user_id = sub()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.conversations c
      WHERE c.conversation_id = conversation_tabs.conversation_id
      AND c.user_id = sub()
    )
  );

-- Users can delete tabs for their own conversations
CREATE POLICY "Users can delete tabs"
  ON app.conversation_tabs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM app.conversations c
      WHERE c.conversation_id = conversation_tabs.conversation_id
      AND c.user_id = sub()
    )
  );

-- ============================================================================
-- MESSAGES POLICIES
-- ============================================================================

-- Users can view messages for tabs they can access
CREATE POLICY "Users can view messages"
  ON app.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM app.conversation_tabs t
      JOIN app.conversations c ON c.conversation_id = t.conversation_id
      WHERE t.tab_id = messages.tab_id
      AND (c.user_id = sub() OR (c.visibility = 'shared' AND iam.is_org_member(c.org_id)))
    )
  );

-- Users can insert messages for their own conversations
CREATE POLICY "Users can insert messages"
  ON app.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.conversation_tabs t
      JOIN app.conversations c ON c.conversation_id = t.conversation_id
      WHERE t.tab_id = messages.tab_id
      AND c.user_id = sub()
    )
  );

-- Users can update messages for their own conversations
CREATE POLICY "Users can update messages"
  ON app.messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM app.conversation_tabs t
      JOIN app.conversations c ON c.conversation_id = t.conversation_id
      WHERE t.tab_id = messages.tab_id
      AND c.user_id = sub()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.conversation_tabs t
      JOIN app.conversations c ON c.conversation_id = t.conversation_id
      WHERE t.tab_id = messages.tab_id
      AND c.user_id = sub()
    )
  );

-- Users can delete messages for their own conversations
CREATE POLICY "Users can delete messages"
  ON app.messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM app.conversation_tabs t
      JOIN app.conversations c ON c.conversation_id = t.conversation_id
      WHERE t.tab_id = messages.tab_id
      AND c.user_id = sub()
    )
  );

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION app.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON app.conversations
  FOR EACH ROW EXECUTE FUNCTION app.update_updated_at();

CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON app.messages
  FOR EACH ROW EXECUTE FUNCTION app.update_updated_at();

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'app' AND table_name IN ('conversations', 'conversation_tabs', 'messages');

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'app' AND tablename IN ('conversations', 'conversation_tabs', 'messages');

-- Check indexes
SELECT indexname, tablename FROM pg_indexes
WHERE schemaname = 'app' AND tablename IN ('conversations', 'conversation_tabs', 'messages');
