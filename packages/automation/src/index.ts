/**
 * @webalive/automation
 *
 * Scheduled automation system for sites.
 * Enables users to set up recurring tasks like calendar syncs,
 * content updates, and scheduled publishing.
 *
 * @example
 * ```typescript
 * import {
 *   type AutomationJob,
 *   computeNextRunAtMs,
 *   dailyAt,
 *   validateCronExpression,
 * } from "@webalive/automation"
 *
 * // Create a daily sync at 6 AM Amsterdam time
 * const schedule = dailyAt(6, "Europe/Amsterdam")
 *
 * // Validate a custom cron expression
 * const error = validateCronExpression("0 9 * * 1-5")
 * if (error) {
 *   console.error("Invalid cron:", error)
 * }
 * ```
 */

// Re-export all types
export * from "./types.js"

// Re-export scheduler utilities
export * from "./scheduler.js"
