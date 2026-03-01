"use client"

/**
 * Polls for new messages in automation run transcripts.
 *
 * Automation runs write messages directly to app.messages (not via Redis stream
 * buffer), so this hook polls fetchTabMessages while an automation transcript is
 * open in the chat UI.
 */

import { useEffect } from "react"
import { logError } from "@/lib/client-error-logger"
import { fetchTabMessages } from "@/lib/db/conversationSync"
import {
  checkRunActivity,
  getNextPollDelay,
  MAX_POLL_DURATION_FALLBACK_MS,
  MAX_POLL_DURATION_WITH_STATUS_MS,
  STATUS_CHECK_INTERVAL_MS,
  STATUS_ERROR_CIRCUIT_BREAKER_THRESHOLD,
} from "./automationTranscriptPollUtils"

interface AutomationTranscriptPollOpts {
  isAutomationRun: boolean
  tabId: string | null
  userId: string | null
  /** job_id from conversation sourceMetadata */
  jobId: string | null
  /** claim_run_id from conversation sourceMetadata */
  claimRunId: string | null
}

export function useAutomationTranscriptPoll(opts: AutomationTranscriptPollOpts) {
  const { isAutomationRun, tabId, userId, jobId, claimRunId } = opts

  useEffect(() => {
    if (!isAutomationRun || !tabId || !userId) return

    const hasStatusCheck = Boolean(jobId && claimRunId)
    const maxPollDuration = hasStatusCheck ? MAX_POLL_DURATION_WITH_STATUS_MS : MAX_POLL_DURATION_FALLBACK_MS

    let isActive = true
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let pollInFlight = false
    let lastStatusCheck = 0
    let statusErrorCount = 0
    let emptyPollCount = 0
    let lastMessageCount: number | null = null
    const startedAt = Date.now()

    const clearScheduledPoll = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    const stopPolling = () => {
      isActive = false
      clearScheduledPoll()
    }

    const poll = async () => {
      if (!isActive || document.hidden || pollInFlight) {
        return
      }

      if (Date.now() - startedAt >= maxPollDuration) {
        stopPolling()
        return
      }

      pollInFlight = true
      try {
        const result = await fetchTabMessages(tabId, userId)

        if (!hasStatusCheck) {
          const currentCount = result.messages.length
          if (lastMessageCount === null) {
            lastMessageCount = currentCount
          } else if (currentCount === lastMessageCount) {
            emptyPollCount += 1
          } else {
            lastMessageCount = currentCount
            emptyPollCount = 0
          }
          return
        }

        const now = Date.now()
        if (now - lastStatusCheck < STATUS_CHECK_INTERVAL_MS) {
          return
        }

        lastStatusCheck = now
        if (!jobId || !claimRunId) {
          return
        }

        const state = await checkRunActivity(jobId, claimRunId)

        if (state === "inactive") {
          await fetchTabMessages(tabId, userId)
          stopPolling()
          return
        }

        if (state === "unknown") {
          statusErrorCount += 1
          if (statusErrorCount >= STATUS_ERROR_CIRCUIT_BREAKER_THRESHOLD) {
            logError("automation-poll", "Stopping transcript polling after repeated status check failures", {
              tabId,
              jobId,
              claimRunId,
              consecutiveFailures: statusErrorCount,
            })
            stopPolling()
          }
          return
        }

        statusErrorCount = 0
      } finally {
        pollInFlight = false
      }
    }

    const tick = async () => {
      await poll()
      if (!isActive) return
      clearScheduledPoll()
      timeoutId = setTimeout(
        () => {
          void tick()
        },
        getNextPollDelay(hasStatusCheck, emptyPollCount),
      )
    }

    // Initial fetch + schedule chain
    void tick()

    const onVisibilityChange = () => {
      if (document.hidden || !isActive || pollInFlight) {
        return
      }
      clearScheduledPoll()
      void tick()
    }

    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [isAutomationRun, tabId, userId, jobId, claimRunId])
}
