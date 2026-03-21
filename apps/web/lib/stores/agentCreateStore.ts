"use client"

import { create } from "zustand"
import type { AutomationConfigData } from "@/components/ai/AutomationConfig"

interface AgentCreateState {
  /** Pending creation data — set by chat tool, consumed by agents tab */
  pendingCreate: AutomationConfigData | null
  /** Callback to notify chat when creation completes or is canceled */
  onComplete: ((message: string) => void) | null
}

interface AgentCreateActions {
  actions: {
    /** Set pending create data and open agents tab */
    startCreate: (data: AutomationConfigData, onComplete: (message: string) => void) => void
    /** Clear pending create (after creation or cancel) */
    clearCreate: () => void
  }
}

type AgentCreateStore = AgentCreateState & AgentCreateActions

export const useAgentCreateStore = create<AgentCreateStore>(set => ({
  pendingCreate: null,
  onComplete: null,
  actions: {
    startCreate: (data, onComplete) => set({ pendingCreate: data, onComplete }),
    clearCreate: () => set({ pendingCreate: null, onComplete: null }),
  },
}))

export const usePendingCreate = () => useAgentCreateStore(s => s.pendingCreate)
export const useAgentCreateActions = () => useAgentCreateStore(s => s.actions)
