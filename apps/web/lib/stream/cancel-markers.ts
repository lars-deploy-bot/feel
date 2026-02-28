/**
 * Marker used in clientStack when cancellation comes from browser unload handlers.
 * The server uses this to distinguish lifecycle beacons from explicit user "Stop" actions.
 */
export const PAGE_UNLOAD_BEACON_MARKER = "PAGE_UNLOAD_BEACON:"

/**
 * Marker used when user already pressed Stop and page unloads before stop request
 * can be fully processed. Unlike generic unload beacons, this one MUST trigger
 * cancellation to preserve explicit user intent.
 */
export const EXPLICIT_STOP_UNLOAD_BEACON_MARKER = "EXPLICIT_STOP_UNLOAD_BEACON:"
