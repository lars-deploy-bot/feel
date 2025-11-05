"use client"
import { useContext } from "react"
import { DevModeContext } from "./dev-mode-context"

/**
 * Central visibility rules for debug content
 *
 * Production: All debug content hidden
 * Dev with "Dev" toggle ON: All debug content visible
 * Dev with "Prod" toggle OFF: All debug content hidden (simulates production)
 */
export function useDebugVisibility() {
  const devMode = useContext(DevModeContext)

  // Show debug content only when:
  // 1. Running in development mode AND
  // 2. Dev toggle is enabled (or context missing - default to true)
  const showDebug = process.env.NODE_ENV === "development" && (devMode?.showDevContent ?? true)

  return {
    showSystemMessages: showDebug, // "System Initialized" debug block
    showCompletionStats: showDebug, // "Completed 3.2s • $0.0031" and "Session complete"
    showThinkingWrapper: showDebug, // "doing some work" / "thinking" wrapper around tool results
    showToolNames: showDebug, // Show "Read (reading)" vs just "reading"
  }
}
