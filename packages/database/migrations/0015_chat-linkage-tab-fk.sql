-- Migration: Add FK for automation_runs.chat_tab_id → conversation_tabs.tab_id
-- Strengthens referential integrity for the chat-linkage schema (#255).

ALTER TABLE app.automation_runs
  ADD CONSTRAINT automation_runs_chat_tab_id_fkey
    FOREIGN KEY (chat_tab_id)
    REFERENCES app.conversation_tabs(tab_id)
    ON DELETE SET NULL;
