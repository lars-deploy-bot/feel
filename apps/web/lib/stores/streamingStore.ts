"use client"

import { autorun, makeAutoObservable, observable, toJS } from "mobx"
import { useCallback, useRef, useSyncExternalStore } from "react"

// =============================================================================
// Types (unchanged — same exports)
// =============================================================================

export interface StreamingError {
  type: "parse_error" | "reader_error" | "timeout_error" | "invalid_event_structure" | "critical_error"
  timestamp: number
  message: string
  linePreview?: string
}

export interface PendingTool {
  toolUseId: string
  toolName: string
  toolInput: unknown
  startedAt: number
  elapsedSeconds: number
}

export interface TabStreamState {
  toolUseMap: Map<string, string>
  toolInputMap: Map<string, unknown>
  pendingTools: Map<string, PendingTool>
  consecutiveParseErrors: number
  recentErrors: StreamingError[]
  maxRecentErrors: number
  lastValidSessionId: string | null
  sessionValidatedAt: number | null
  isStreamActive: boolean
  lastMessageReceivedAt: number | null
  messagesReceivedInStream: number
  lastSeenStreamSeq: number | null
}

// =============================================================================
// MobX Store
// =============================================================================

class TabStream {
  toolUseMap = observable.map<string, string>()
  toolInputMap = observable.map<string, unknown>()
  pendingTools = observable.map<string, PendingTool>()
  consecutiveParseErrors = 0
  recentErrors: StreamingError[] = []
  maxRecentErrors = 10
  lastValidSessionId: string | null = null
  sessionValidatedAt: number | null = null
  isStreamActive = false
  lastMessageReceivedAt: number | null = null
  messagesReceivedInStream = 0
  lastSeenStreamSeq: number | null = null
  abortController: AbortController | null = null

  constructor() {
    makeAutoObservable(this, {
      // AbortController is not observable — just a plain field
      abortController: false,
    })
  }

  get pendingToolsList(): PendingTool[] {
    return [...this.pendingTools.values()]
  }

  get streamHealth(): { isActive: boolean; messageCount: number; timeSinceLastMessage: number | null } {
    return {
      isActive: this.isStreamActive,
      messageCount: this.messagesReceivedInStream,
      timeSinceLastMessage: this.lastMessageReceivedAt ? Date.now() - this.lastMessageReceivedAt : null,
    }
  }
}

class StreamingStore {
  tabs = observable.map<string, TabStream>()

  constructor() {
    makeAutoObservable(this)
  }

  private getOrCreateTab(tabId: string): TabStream {
    let tab = this.tabs.get(tabId)
    if (!tab) {
      tab = new TabStream()
      this.tabs.set(tabId, tab)
    }
    return tab
  }

  // -- Tool use tracking --

  recordToolUse(tabId: string, toolUseId: string, toolName: string, toolInput?: unknown) {
    const tab = this.getOrCreateTab(tabId)
    tab.toolUseMap.set(toolUseId, toolName)
    if (toolInput !== undefined) {
      tab.toolInputMap.set(toolUseId, toolInput)
    }
  }

  getToolName(tabId: string, toolUseId: string): string | undefined {
    return this.tabs.get(tabId)?.toolUseMap.get(toolUseId)
  }

  getToolInput(tabId: string, toolUseId: string): unknown | undefined {
    const val = this.tabs.get(tabId)?.toolInputMap.get(toolUseId)
    if (val === undefined) return undefined
    // toJS strips MobX proxy — plain object safe for IndexedDB structured clone
    return toJS(val)
  }

  clearToolUseMap(tabId: string) {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    tab.toolUseMap.clear()
    tab.toolInputMap.clear()
  }

  // -- Pending tools --

  markToolPending(tabId: string, toolUseId: string, toolName: string, toolInput: unknown) {
    const tab = this.getOrCreateTab(tabId)
    tab.pendingTools.set(toolUseId, {
      toolUseId,
      toolName,
      toolInput: toJS(toolInput),
      startedAt: Date.now(),
      elapsedSeconds: 0,
    })
  }

  updateToolProgress(tabId: string, toolUseId: string, elapsedSeconds: number) {
    const existing = this.tabs.get(tabId)?.pendingTools.get(toolUseId)
    if (!existing) return
    this.tabs.get(tabId)!.pendingTools.set(toolUseId, { ...existing, elapsedSeconds })
  }

  markToolComplete(tabId: string, toolUseId: string) {
    this.tabs.get(tabId)?.pendingTools.delete(toolUseId)
  }

  getPendingTools(tabId: string): PendingTool[] {
    const tab = this.tabs.get(tabId)
    if (!tab) return []
    return toJS([...tab.pendingTools.values()])
  }

  // -- Error tracking --

  recordError(tabId: string, error: Omit<StreamingError, "timestamp">) {
    const tab = this.getOrCreateTab(tabId)
    const newError: StreamingError = { ...error, timestamp: Date.now() }
    tab.recentErrors = [newError, ...tab.recentErrors].slice(0, tab.maxRecentErrors)
  }

  resetConsecutiveErrors(tabId: string) {
    const tab = this.tabs.get(tabId)
    if (tab) tab.consecutiveParseErrors = 0
  }

  incrementConsecutiveErrors(tabId: string) {
    const tab = this.getOrCreateTab(tabId)
    tab.consecutiveParseErrors++
  }

  getConsecutiveErrors(tabId: string): number {
    return this.tabs.get(tabId)?.consecutiveParseErrors ?? 0
  }

  // -- Session tracking --

  recordSessionId(tabId: string, sessionId: string) {
    const tab = this.getOrCreateTab(tabId)
    tab.lastValidSessionId = sessionId
    tab.sessionValidatedAt = Date.now()
  }

  getLastSessionId(tabId: string): string | null {
    return this.tabs.get(tabId)?.lastValidSessionId ?? null
  }

  // -- Stream health --

  startStream(tabId: string) {
    const tab = this.getOrCreateTab(tabId)
    tab.isStreamActive = true
    tab.messagesReceivedInStream = 0
    tab.lastSeenStreamSeq = null
  }

  recordMessageReceived(tabId: string) {
    const tab = this.getOrCreateTab(tabId)
    tab.lastMessageReceivedAt = Date.now()
    tab.messagesReceivedInStream++
  }

  recordStreamSeq(tabId: string, streamSeq: number) {
    const tab = this.getOrCreateTab(tabId)
    tab.lastSeenStreamSeq = Math.max(tab.lastSeenStreamSeq ?? 0, streamSeq)
  }

  getLastSeenStreamSeq(tabId: string): number | null {
    return this.tabs.get(tabId)?.lastSeenStreamSeq ?? null
  }

  endStream(tabId: string) {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    tab.isStreamActive = false
    tab.pendingTools.clear()
  }

  getStreamHealth(tabId: string): { isActive: boolean; messageCount: number; timeSinceLastMessage: number | null } {
    const tab = this.tabs.get(tabId)
    if (!tab) return { isActive: false, messageCount: 0, timeSinceLastMessage: null }
    return tab.streamHealth
  }

  // -- Tab state (for compatibility) --

  getTabState(tabId: string): TabStreamState {
    const tab = this.getOrCreateTab(tabId)
    return {
      toolUseMap: new Map(toJS(tab.toolUseMap)),
      toolInputMap: new Map(toJS(tab.toolInputMap)),
      pendingTools: new Map(toJS(tab.pendingTools)),
      consecutiveParseErrors: tab.consecutiveParseErrors,
      recentErrors: toJS(tab.recentErrors),
      maxRecentErrors: tab.maxRecentErrors,
      lastValidSessionId: tab.lastValidSessionId,
      sessionValidatedAt: tab.sessionValidatedAt,
      isStreamActive: tab.isStreamActive,
      lastMessageReceivedAt: tab.lastMessageReceivedAt,
      messagesReceivedInStream: tab.messagesReceivedInStream,
      lastSeenStreamSeq: tab.lastSeenStreamSeq,
    }
  }

  // -- Cleanup --

  clearTab(tabId: string) {
    this.tabs.delete(tabId)
  }

  clearAllTabs() {
    this.tabs.clear()
  }
}

// Singleton
const store = new StreamingStore()

// =============================================================================
// AbortController helpers (same standalone exports — now backed by TabStream)
// =============================================================================

export function getAbortController(tabId: string): AbortController | undefined {
  return store.tabs.get(tabId)?.abortController ?? undefined
}

export function setAbortController(tabId: string, controller: AbortController | null): void {
  const tab = store.tabs.get(tabId)
  if (tab) {
    tab.abortController = controller
  } else if (controller) {
    // Tab doesn't exist yet — create it so controller has a home
    const newTab = new TabStream()
    newTab.abortController = controller
    store.tabs.set(tabId, newTab)
  }
}

export function clearAbortController(tabId: string): void {
  const tab = store.tabs.get(tabId)
  if (tab) tab.abortController = null
}

// =============================================================================
// Actions interface (same type as before — message-parser imports this)
// =============================================================================

export interface StreamingStoreState {
  tabs: Record<string, TabStreamState>
  actions: {
    getTabState: (tabId: string) => TabStreamState
    recordToolUse: (tabId: string, toolUseId: string, toolName: string, toolInput?: unknown) => void
    getToolName: (tabId: string, toolUseId: string) => string | undefined
    getToolInput: (tabId: string, toolUseId: string) => unknown | undefined
    clearToolUseMap: (tabId: string) => void
    markToolPending: (tabId: string, toolUseId: string, toolName: string, toolInput: unknown) => void
    updateToolProgress: (tabId: string, toolUseId: string, elapsedSeconds: number) => void
    markToolComplete: (tabId: string, toolUseId: string) => void
    getPendingTools: (tabId: string) => PendingTool[]
    recordError: (tabId: string, error: Omit<StreamingError, "timestamp">) => void
    resetConsecutiveErrors: (tabId: string) => void
    incrementConsecutiveErrors: (tabId: string) => void
    getConsecutiveErrors: (tabId: string) => number
    recordSessionId: (tabId: string, sessionId: string) => void
    getLastSessionId: (tabId: string) => string | null
    startStream: (tabId: string) => void
    recordMessageReceived: (tabId: string) => void
    recordStreamSeq: (tabId: string, streamSeq: number) => void
    getLastSeenStreamSeq: (tabId: string) => number | null
    endStream: (tabId: string) => void
    getStreamHealth: (tabId: string) => { isActive: boolean; messageCount: number; timeSinceLastMessage: number | null }
    clearTab: (tabId: string) => void
    clearAllTabs: () => void
  }
}

// Stable actions object — bound methods from the MobX store
const actions: StreamingStoreState["actions"] = {
  getTabState: tabId => store.getTabState(tabId),
  recordToolUse: (tabId, toolUseId, toolName, toolInput) => store.recordToolUse(tabId, toolUseId, toolName, toolInput),
  getToolName: (tabId, toolUseId) => store.getToolName(tabId, toolUseId),
  getToolInput: (tabId, toolUseId) => store.getToolInput(tabId, toolUseId),
  clearToolUseMap: tabId => store.clearToolUseMap(tabId),
  markToolPending: (tabId, toolUseId, toolName, toolInput) =>
    store.markToolPending(tabId, toolUseId, toolName, toolInput),
  updateToolProgress: (tabId, toolUseId, elapsedSeconds) => store.updateToolProgress(tabId, toolUseId, elapsedSeconds),
  markToolComplete: (tabId, toolUseId) => store.markToolComplete(tabId, toolUseId),
  getPendingTools: tabId => store.getPendingTools(tabId),
  recordError: (tabId, error) => store.recordError(tabId, error),
  resetConsecutiveErrors: tabId => store.resetConsecutiveErrors(tabId),
  incrementConsecutiveErrors: tabId => store.incrementConsecutiveErrors(tabId),
  getConsecutiveErrors: tabId => store.getConsecutiveErrors(tabId),
  recordSessionId: (tabId, sessionId) => store.recordSessionId(tabId, sessionId),
  getLastSessionId: tabId => store.getLastSessionId(tabId),
  startStream: tabId => store.startStream(tabId),
  recordMessageReceived: tabId => store.recordMessageReceived(tabId),
  recordStreamSeq: (tabId, streamSeq) => store.recordStreamSeq(tabId, streamSeq),
  getLastSeenStreamSeq: tabId => store.getLastSeenStreamSeq(tabId),
  endStream: tabId => store.endStream(tabId),
  getStreamHealth: tabId => store.getStreamHealth(tabId),
  clearTab: tabId => store.clearTab(tabId),
  clearAllTabs: () => store.clearAllTabs(),
}

// =============================================================================
// Zustand-compatible facade — useStreamingStore.getState() works for tests
// =============================================================================

function getState(): StreamingStoreState {
  const tabsRecord: Record<string, TabStreamState> = {}
  for (const [tabId] of store.tabs) {
    tabsRecord[tabId] = store.getTabState(tabId)
  }
  return { tabs: tabsRecord, actions }
}

/**
 * Zustand-compatible hook + .getState() for backwards compatibility.
 * Consumers that use `useStreamingStore(selector)` get a reactive bridge.
 * Consumers that use `useStreamingStore.getState()` get a snapshot.
 */
export const useStreamingStore = Object.assign(
  function useStreamingStoreHook<T>(selector: (state: StreamingStoreState) => T): T {
    return useMobxValue(() => selector(getState()), [])
  },
  { getState },
)

// =============================================================================
// Hook helper: bridge MobX → React for a single derived value
// =============================================================================

/**
 * Bridge MobX → React via useSyncExternalStore.
 * Concurrent-safe, no double-render, re-subscribes when deps change.
 *
 * - subscribe: autorun tracks MobX observables read by `fn`, calls listener on change
 * - getSnapshot: returns the latest value from `fn`
 *
 * @see https://github.com/mobxjs/mobx/discussions/3589
 * @see https://react.dev/reference/react/useSyncExternalStore
 */
function useMobxValue<T>(fn: () => T, deps: unknown[]): T {
  // Keep fn fresh without re-subscribing on every render
  const fnRef = useRef(fn)
  fnRef.current = fn

  // Cache the latest snapshot so getSnapshot returns a stable reference
  const snapshotRef = useRef<T>(fn())

  // subscribe and getSnapshot must be stable per deps — useSyncExternalStore
  // re-subscribes when subscribe identity changes.
  const subscribe = useCallback((listener: () => void) => {
    const dispose = autorun(() => {
      snapshotRef.current = fnRef.current()
      listener()
    })
    return dispose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const getSnapshot = useCallback(() => snapshotRef.current, [subscribe])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

// =============================================================================
// Atomic selectors (same exports as before)
// =============================================================================

export const useStreamingActions = () => actions

export const useTabToolMap = (tabId: string) =>
  useMobxValue(() => new Map(store.tabs.get(tabId)?.toolUseMap ?? []), [tabId])

export const useTabErrors = (tabId: string) => ({
  consecutive: useMobxValue(() => store.tabs.get(tabId)?.consecutiveParseErrors ?? 0, [tabId]),
  recent: useMobxValue(() => store.tabs.get(tabId)?.recentErrors ?? [], [tabId]),
})

export const useStreamHealth = (tabId: string) => useMobxValue(() => store.getStreamHealth(tabId), [tabId])

export const useLastSeenStreamSeq = (tabId: string | null) =>
  useMobxValue(() => (tabId ? store.getLastSeenStreamSeq(tabId) : null), [tabId])

export const useIsStreamActive = (tabId: string | null) =>
  useMobxValue(() => (tabId ? (store.tabs.get(tabId)?.isStreamActive ?? false) : false), [tabId])

export const usePendingTools = (tabId: string | null) =>
  useMobxValue(() => (tabId ? store.getPendingTools(tabId) : []), [tabId])
