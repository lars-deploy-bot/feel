"use client"

import { useEffect, useRef } from "react"

/**
 * Ensures the E2B sandbox + dev server is running when a workspace opens.
 * No-ops for systemd workspaces (fast 200 from the API).
 * Fires once per workspace change — deduplicates with a ref.
 */
export function useSandboxEnsure(workspace: string | null) {
  const lastEnsured = useRef<string | null>(null)

  useEffect(() => {
    if (!workspace || workspace === lastEnsured.current) return
    lastEnsured.current = workspace

    // Fire and forget — don't block UI
    fetch("/api/sandbox/ensure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace }),
    }).catch(() => {
      // Non-fatal: sandbox will be started on first file op or chat message
    })
  }, [workspace])
}
