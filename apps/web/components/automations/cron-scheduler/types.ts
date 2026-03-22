/**
 * Cron expression parts and types for the cron scheduler component
 */

export type { CronParts } from "@/lib/automation/cron-description"

export interface CronPreset {
  label: string
  value: string
  description: string
}

export type CronMode = "preset" | "custom"

export interface CronEditorState {
  mode: CronMode
  preset: string
  customExpression: string
  parsedDescription: string
}
