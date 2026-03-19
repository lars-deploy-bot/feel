/**
 * Re-export from @/lib/automation/cron-description — the canonical location.
 *
 * This file exists so internal cron-scheduler components can continue
 * importing from "./cron-parser" without updating every import.
 */

export type { CronParts } from "@/lib/automation/cron-description"
export { describeCron, parseCronExpression } from "@/lib/automation/cron-description"
