"use client"

import { useMemo } from "react"
import { useStreamingStore } from "@/lib/stores/streamingStore"
import { useTabDataStore } from "@/lib/stores/tabDataStore"

/**
 * Derives the set of conversation (tabGroup) IDs that have an active stream.
 * Bridges tabId-based streaming state → tabGroupId for sidebar indicators.
 */
export function useStreamingConversations(): ReadonlySet<string> {
  const streamingTabs = useStreamingStore(state => state.tabs)
  const tabsByWorkspace = useTabDataStore(s => s.tabsByWorkspace)

  return useMemo(() => {
    const tabGroupByTabId = new Map<string, string>()
    for (const tabs of Object.values(tabsByWorkspace)) {
      for (const tab of tabs) {
        tabGroupByTabId.set(tab.id, tab.tabGroupId)
      }
    }

    const active = new Set<string>()
    for (const [tabId, tabState] of Object.entries(streamingTabs)) {
      if (!tabState.isStreamActive) continue
      const tabGroupId = tabGroupByTabId.get(tabId)
      if (tabGroupId) {
        active.add(tabGroupId)
      }
    }

    return active
  }, [streamingTabs, tabsByWorkspace])
}
