/**
 * Dexie Database Module
 *
 * Exports for the new Dexie.js-based message storage system.
 *
 * Usage:
 * ```typescript
 * import {
 *   useDexieMessageStore,
 *   useDexieConversations,
 *   useDexieMessages,
 *   migrateLegacyStorage,
 * } from "@/lib/db"
 * ```
 */

// Core database
export {
  getMessageDb,
  resetMessageDb,
  getMessageDbName,
  CURRENT_MESSAGE_VERSION,
  type DbConversation,
  type DbMessage,
  type DbTab,
  type DbMessageContent,
  type DbMessageType,
  type DbMessageStatus,
  type DbMessageOrigin,
  type ConversationVisibility,
} from "./messageDb"

// Safe operations wrapper
export { safeDb, safeDbWithHandler, type DbError } from "./safeDb"

// Type adapters
export {
  toDbMessage,
  toDbMessageContent,
  toDbMessageType,
  toUIMessage,
  toUIMessages,
  extractTitle,
  isEmptyContent,
} from "./messageAdapters"

// Sync service
export {
  queueSync,
  forceSyncNow,
  fetchConversations,
  fetchTabMessages,
  shareConversation,
  unshareConversation,
  deleteConversation,
  subscribeToSharedConversations,
} from "./conversationSync"

// React hooks
export {
  useConversations,
  useSharedConversations,
  useConversation,
  useTabs,
  useTab,
  useMessages,
  usePendingMessages,
  useCurrentConversationSafe,
  useConversationMessageCount,
  useHasPendingSyncs,
  type SessionContext,
} from "./useMessageDb"

// Migration
export { migrateLegacyStorage, needsMigration, clearLegacyStorage } from "./migrateLegacyStorage"

// Tab messages hook (merges Dexie + streaming buffers)
export {
  useTabMessages,
  useActiveStreamId,
  useIsTabStreaming,
  useStreamingText,
  type TabMessage,
} from "./useTabMessages"

// Zustand store (new implementation)
export {
  useDexieMessageStore,
  useDexieCurrentConversationId,
  useDexieCurrentTabGroupId,
  useDexieCurrentTabId,
  useDexieCurrentWorkspace,
  useDexieIsSyncing,
  useDexieIsLoading,
  useDexieSession,
  useDexieMessageActions,
  // Re-exported hooks with Dexie prefix
  useDexieConversations,
  useDexieSharedConversations,
  useDexieMessages,
  useDexieTabs,
  useDexieConversation,
  useDexieCurrentConversationSafe,
  type DexieSessionContext,
} from "./dexieMessageStore"
