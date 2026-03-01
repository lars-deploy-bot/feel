"use client"

/**
 * Polls for new messages in automation run transcripts.
 *
 * Automation runs write messages directly to app.messages (not via Redis stream buffer),
 * so the normal useStreamReconnect hook doesn't apply. Instead, we poll fetchTabMessages()
 * at a fixed interval while viewing an automation_run conversation.
 *
 * Stops polling when:
 * - No new messages arrive for MAX_STALE_POLLS consecutive checks
 * - The browser tab is hidden
 * - The active conversation is not an automation run
 */

import { useEffect, useRef } from "react"
import { fetchTabMessages } from "@/lib/db/conversationSync"

const POLL_INTERVAL_MS = 3_000
const MAX_STALE_POLLS = 3 // Stop after 3 polls (~9s) with no new messages

export function useAutomationTranscriptPoll(opts: {
  isAutomationRun: boolean
  tabId: string | null
  userId: string | null
}) {
  const { isAutomationRun, tabId, userId } = opts
  const lastCountRef = useRef(0)
  const staleRef = useRef(0)
  const activeRef = useRef(true)

  useEffect(() => {
    if (!isAutomationRun || !tabId || !userId) return

    // Reset state on conversation change
    staleRef.current = 0
    lastCountRef.current = 0
    activeRef.current = true

    const poll = async () => {
      if (document.hidden || !activeRef.current) return

      const result = await fetchTabMessages(tabId, userId)
      const count = result.messages.length

      if (count <= lastCountRef.current) {
        staleRef.current++
        if (staleRef.current >= MAX_STALE_POLLS) {
          activeRef.current = false
        }
      } else {
        staleRef.current = 0
        lastCountRef.current = count
      }
    }

    // Initial fetch
    void poll()

    const interval = setInterval(() => {
      if (!activeRef.current) {
        clearInterval(interval)
        return
      }
      void poll()
    }, POLL_INTERVAL_MS)

    return () => {
      activeRef.current = false
      clearInterval(interval)
    }
  }, [isAutomationRun, tabId, userId])
}
