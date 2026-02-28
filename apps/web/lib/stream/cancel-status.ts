/**
 * Canonical cancel endpoint statuses.
 * Shared by route responses, API schema validation, and frontend consumers.
 */
export const CANCEL_ENDPOINT_STATUS = {
  CANCELLED: "cancelled",
  CANCEL_TIMED_OUT: "cancel_timed_out",
  ALREADY_COMPLETE: "already_complete",
  IGNORED_UNLOAD_BEACON: "ignored_unload_beacon",
  CANCEL_QUEUED: "cancel_queued",
} as const

export type CancelEndpointStatus = (typeof CANCEL_ENDPOINT_STATUS)[keyof typeof CANCEL_ENDPOINT_STATUS]

export const CANCEL_ENDPOINT_STATUS_VALUES = [
  CANCEL_ENDPOINT_STATUS.CANCELLED,
  CANCEL_ENDPOINT_STATUS.CANCEL_TIMED_OUT,
  CANCEL_ENDPOINT_STATUS.ALREADY_COMPLETE,
  CANCEL_ENDPOINT_STATUS.IGNORED_UNLOAD_BEACON,
  CANCEL_ENDPOINT_STATUS.CANCEL_QUEUED,
] as const

/**
 * Cancel resolution statuses shown in interrupt metadata.
 * Includes endpoint statuses plus local client-side outcomes.
 */
export type CancelResolutionStatus = CancelEndpointStatus | "timeout" | "failed"
