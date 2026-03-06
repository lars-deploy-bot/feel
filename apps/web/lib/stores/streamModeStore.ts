"use client"

import type { StreamMode } from "@webalive/shared"
import { create } from "zustand"

const useStreamModeStore = create<{
  mode: StreamMode
  actions: {
    setMode: (mode: StreamMode) => void
    toggleMode: (target: StreamMode) => void
  }
}>()(set => ({
  mode: "default" satisfies StreamMode,
  actions: {
    setMode: mode => set({ mode }),
    toggleMode: target => set(s => ({ mode: s.mode === target ? "default" : target })),
  },
}))

export const useStreamMode = () => useStreamModeStore(s => s.mode)
export const useStreamModeActions = () => useStreamModeStore(s => s.actions)
export const getStreamModeState = () => useStreamModeStore.getState()

// Backward compat for existing plan mode consumers
export const usePlanMode = () => useStreamModeStore(s => s.mode === "plan")
export const usePlanModeActions = () => {
  const { toggleMode, setMode } = useStreamModeStore(s => s.actions)
  return {
    enablePlanMode: () => setMode("plan"),
    disablePlanMode: () => setMode("default"),
    togglePlanMode: () => toggleMode("plan"),
  }
}
export const getPlanModeState = () => ({ planMode: useStreamModeStore.getState().mode === "plan" })
