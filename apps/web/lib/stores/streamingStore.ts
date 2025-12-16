"use client"

import { create } from "zustand"

/**
 * Per-conversation abort controllers (stored outside Zustand because AbortController isn't serializable)
 * This enables independent stream cancellation when tabs are enabled.
 */
const abortControllerMap = new Map<string, AbortController>()

/** Get the abort controller for a conversation */
export function getAbortController(conversationId: string): AbortController | undefined {
  return abortControllerMap.get(conversationId)
}

/** Set the abort controller for a conversation */
export function setAbortController(conversationId: string, controller: AbortController | null): void {
  if (controller) {
    abortControllerMap.set(conversationId, controller)
  } else {
    abortControllerMap.delete(conversationId)
  }
}

/** Clear the abort controller for a conversation */
export function clearAbortController(conversationId: string): void {
  abortControllerMap.delete(conversationId)
}

/**
 * Streaming State Store - Manages per-conversation streaming state
 *
 * **IMPORTANT**: This store is IN-MEMORY ONLY (not persisted).
 * - Streaming state only matters during active streams
 * - Tool mappings, errors, and health metrics are ephemeral
 * - On page refresh, messages are restored from messageStore; streaming state resets (correct behavior)
 *
 * Solves brittleness issues:
 * 1. Per-conversation toolUseMap (not global) - no collisions across conversations
 * 2. Parse error tracking with recovery thresholds - per-conversation error state
 * 3. Session ID validation - validate session IDs per conversation
 * 4. Stream health metrics - track message count, timing
 * 5. Proper cleanup on conversation end
 *
 * Pattern follows Zustand Guide §14.1-14.3:
 * - State + Actions separation (actions in stable object)
 * - Atomic selectors (single-value hooks)
 * - Scoped per conversation (no global state leaks)
 */

export interface StreamingError {
  type: "parse_error" | "reader_error" | "timeout_error" | "invalid_event_structure" | "critical_error"
  timestamp: number
  message: string
  linePreview?: string
}

export interface ConversationStreamState {
  // Tool use tracking (per-conversation, not global)
  toolUseMap: Map<string, string>
  // Tool input tracking - stores the input for each tool_use_id
  toolInputMap: Map<string, unknown>

  // Error recovery
  consecutiveParseErrors: number
  recentErrors: StreamingError[]
  maxRecentErrors: number

  // Session validation
  lastValidSessionId: string | null
  sessionValidatedAt: number | null

  // Stream health
  isStreamActive: boolean
  lastMessageReceivedAt: number | null
  messagesReceivedInStream: number
}

export interface StreamingStoreState {
  // Map of conversationId -> StreamingState
  conversations: Record<string, ConversationStreamState>

  // Actions
  actions: {
    // Initialize or get conversation state
    getConversationState: (conversationId: string) => ConversationStreamState

    // Tool use tracking
    recordToolUse: (conversationId: string, toolUseId: string, toolName: string, toolInput?: unknown) => void
    getToolName: (conversationId: string, toolUseId: string) => string | undefined
    getToolInput: (conversationId: string, toolUseId: string) => unknown | undefined
    clearToolUseMap: (conversationId: string) => void

    // Error tracking
    recordError: (conversationId: string, error: Omit<StreamingError, "timestamp">) => void
    resetConsecutiveErrors: (conversationId: string) => void
    incrementConsecutiveErrors: (conversationId: string) => void
    getConsecutiveErrors: (conversationId: string) => number

    // Session tracking
    recordSessionId: (conversationId: string, sessionId: string) => void
    getLastSessionId: (conversationId: string) => string | null

    // Stream health
    startStream: (conversationId: string) => void
    recordMessageReceived: (conversationId: string) => void
    endStream: (conversationId: string) => void
    getStreamHealth: (conversationId: string) => {
      isActive: boolean
      messageCount: number
      timeSinceLastMessage: number | null
    }

    // Cleanup
    clearConversation: (conversationId: string) => void
    clearAllConversations: () => void
  }
}

const defaultConversationState: ConversationStreamState = {
  toolUseMap: new Map(),
  toolInputMap: new Map(),
  consecutiveParseErrors: 0,
  recentErrors: [],
  maxRecentErrors: 10,
  lastValidSessionId: null,
  sessionValidatedAt: null,
  isStreamActive: false,
  lastMessageReceivedAt: null,
  messagesReceivedInStream: 0,
}

export const useStreamingStore = create<StreamingStoreState>((set, get) => {
  // Helper: Update a conversation's state without boilerplate
  const updateConversation = (conversationId: string, updates: Partial<ConversationStreamState>): void => {
    set(s => ({
      conversations: {
        ...s.conversations,
        [conversationId]: {
          ...(s.conversations[conversationId] || defaultConversationState),
          ...updates,
        },
      },
    }))
  }

  return {
    conversations: {},

    actions: {
      getConversationState: (conversationId: string): ConversationStreamState => {
        const state = get()
        const existing = state.conversations[conversationId]
        if (!existing) {
          updateConversation(conversationId, defaultConversationState)
          return { ...defaultConversationState }
        }
        return existing
      },

      recordToolUse: (conversationId: string, toolUseId: string, toolName: string, toolInput?: unknown): void => {
        const state = get()
        const convState = state.conversations[conversationId] || { ...defaultConversationState }
        const newToolUseMap = new Map(convState.toolUseMap)
        newToolUseMap.set(toolUseId, toolName)
        const newToolInputMap = new Map(convState.toolInputMap)
        if (toolInput !== undefined) {
          newToolInputMap.set(toolUseId, toolInput)
        }
        updateConversation(conversationId, { toolUseMap: newToolUseMap, toolInputMap: newToolInputMap })
      },

      getToolName: (conversationId: string, toolUseId: string): string | undefined => {
        const state = get()
        return state.conversations[conversationId]?.toolUseMap.get(toolUseId)
      },

      getToolInput: (conversationId: string, toolUseId: string): unknown | undefined => {
        const state = get()
        return state.conversations[conversationId]?.toolInputMap.get(toolUseId)
      },

      clearToolUseMap: (conversationId: string): void => {
        updateConversation(conversationId, { toolUseMap: new Map(), toolInputMap: new Map() })
      },

      recordError: (conversationId: string, error: Omit<StreamingError, "timestamp">): void => {
        const state = get()
        const convState = state.conversations[conversationId] || { ...defaultConversationState }
        const newError: StreamingError = {
          ...error,
          timestamp: Date.now(),
        }
        const recentErrors = [newError, ...convState.recentErrors].slice(0, convState.maxRecentErrors)
        updateConversation(conversationId, { recentErrors })
      },

      resetConsecutiveErrors: (conversationId: string): void => {
        updateConversation(conversationId, { consecutiveParseErrors: 0 })
      },

      incrementConsecutiveErrors: (conversationId: string): void => {
        const state = get()
        const convState = state.conversations[conversationId] || { ...defaultConversationState }
        updateConversation(conversationId, {
          consecutiveParseErrors: convState.consecutiveParseErrors + 1,
        })
      },

      getConsecutiveErrors: (conversationId: string): number => {
        const state = get()
        return state.conversations[conversationId]?.consecutiveParseErrors || 0
      },

      recordSessionId: (conversationId: string, sessionId: string): void => {
        updateConversation(conversationId, {
          lastValidSessionId: sessionId,
          sessionValidatedAt: Date.now(),
        })
      },

      getLastSessionId: (conversationId: string): string | null => {
        const state = get()
        return state.conversations[conversationId]?.lastValidSessionId || null
      },

      startStream: (conversationId: string): void => {
        console.log("[StreamingStore] startStream:", conversationId)
        updateConversation(conversationId, {
          isStreamActive: true,
          messagesReceivedInStream: 0,
        })
      },

      recordMessageReceived: (conversationId: string): void => {
        const state = get()
        const convState = state.conversations[conversationId] || { ...defaultConversationState }
        updateConversation(conversationId, {
          lastMessageReceivedAt: Date.now(),
          messagesReceivedInStream: convState.messagesReceivedInStream + 1,
        })
      },

      endStream: (conversationId: string): void => {
        updateConversation(conversationId, { isStreamActive: false })
      },

      getStreamHealth: (
        conversationId: string,
      ): { isActive: boolean; messageCount: number; timeSinceLastMessage: number | null } => {
        const state = get()
        const convState = state.conversations[conversationId]
        if (!convState) {
          return { isActive: false, messageCount: 0, timeSinceLastMessage: null }
        }
        return {
          isActive: convState.isStreamActive,
          messageCount: convState.messagesReceivedInStream,
          timeSinceLastMessage: convState.lastMessageReceivedAt ? Date.now() - convState.lastMessageReceivedAt : null,
        }
      },

      clearConversation: (conversationId: string): void => {
        set(s => {
          const { [conversationId]: _, ...rest } = s.conversations
          return { conversations: rest }
        })
      },

      clearAllConversations: (): void => {
        set({ conversations: {} })
      },
    },
  }
})

// Atomic selectors (Guide §14.1)
export const useStreamingActions = () => useStreamingStore(state => state.actions)

export const useConversationToolMap = (conversationId: string) =>
  useStreamingStore(state => state.conversations[conversationId]?.toolUseMap || new Map())

export const useConversationErrors = (conversationId: string) => ({
  consecutive: useStreamingStore(state => state.conversations[conversationId]?.consecutiveParseErrors || 0),
  recent: useStreamingStore(state => state.conversations[conversationId]?.recentErrors || []),
})

export const useStreamHealth = (conversationId: string) => {
  const actions = useStreamingActions()
  return actions.getStreamHealth(conversationId)
}

/** Returns true if the specified conversation has an active stream (busy) */
export const useIsStreamActive = (conversationId: string | null) =>
  useStreamingStore(state => (conversationId ? (state.conversations[conversationId]?.isStreamActive ?? false) : false))
