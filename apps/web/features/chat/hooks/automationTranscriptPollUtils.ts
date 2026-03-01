import { isRunStatus, type RunStatus } from "@webalive/database"
import { logError } from "@/lib/client-error-logger"

/** Statuses that indicate a run is still in progress (business logic). */
const ACTIVE_RUN_STATUSES: ReadonlySet<RunStatus> = new Set(["pending", "running"])

export const POLL_INTERVAL_MS = 3_000
export const BACKOFF_POLL_INTERVAL_MS = 10_000
export const STATUS_CHECK_INTERVAL_MS = 10_000

/** Polling with metadata should still be bounded; avoids infinite loops on API failures. */
export const MAX_POLL_DURATION_WITH_STATUS_MS = 45 * 60 * 1_000

/** Fallback mode (missing metadata) is intentionally shorter to limit background churn. */
export const MAX_POLL_DURATION_FALLBACK_MS = 20 * 60 * 1_000

/** Slow down polling when transcript message count remains unchanged for many ticks. */
export const EMPTY_POLL_BACKOFF_THRESHOLD = 10

/** Stop polling if run-status checks keep failing; prevents endless 3s loops. */
export const STATUS_ERROR_CIRCUIT_BREAKER_THRESHOLD = 6

export type RunActivity = "active" | "inactive" | "unknown"

interface RunDetailsResponse {
  run?: {
    status?: unknown
  }
}

export function getNextPollDelay(hasStatusCheck: boolean, emptyPollCount: number): number {
  if (!hasStatusCheck && emptyPollCount >= EMPTY_POLL_BACKOFF_THRESHOLD) {
    return BACKOFF_POLL_INTERVAL_MS
  }
  return POLL_INTERVAL_MS
}

/**
 * Check run status via GET /api/automations/[id]/runs/[runId].
 * Uses includeMessages=false so polling does not fetch large transcript payloads.
 */
export async function checkRunActivity(jobId: string, claimRunId: string): Promise<RunActivity> {
  try {
    const res = await fetch(`/api/automations/${jobId}/runs/${claimRunId}?includeMessages=false`, {
      credentials: "include",
    })

    if (res.status === 404) {
      return "inactive"
    }

    if (!res.ok) {
      logError("automation-poll", "Run status API returned non-OK", {
        jobId,
        claimRunId,
        status: res.status,
      })
      return "unknown"
    }

    const data: RunDetailsResponse = await res.json()
    const status = data.run?.status

    if (!isRunStatus(status)) {
      logError("automation-poll", "Run status API returned unknown status", {
        jobId,
        claimRunId,
        status,
      })
      return "unknown"
    }

    return ACTIVE_RUN_STATUSES.has(status) ? "active" : "inactive"
  } catch (error) {
    logError("automation-poll", "Run status network error", {
      error: error instanceof Error ? error : undefined,
      jobId,
      claimRunId,
    })
    return "unknown"
  }
}
