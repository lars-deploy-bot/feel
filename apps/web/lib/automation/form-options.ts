/**
 * Shared option arrays for automation forms.
 *
 * Single source of truth for model and timezone dropdowns used in:
 *   - AutomationConfig (chat flow)
 *   - GeneralTab (settings side panel)
 *   - TriggerTab (settings side panel)
 */

import type { ClaudeModel } from "@webalive/shared"
import { CLAUDE_MODELS, getModelDisplayName } from "@webalive/shared"

export const MODEL_OPTIONS: { label: string; value: ClaudeModel }[] = Object.values(CLAUDE_MODELS).map(id => ({
  label: getModelDisplayName(id),
  value: id,
}))

export const TIMEZONE_OPTIONS = [
  { label: "Amsterdam (CET/CEST)", value: "Europe/Amsterdam" },
  { label: "London (GMT/BST)", value: "Europe/London" },
  { label: "New York (EST/EDT)", value: "America/New_York" },
  { label: "Los Angeles (PST/PDT)", value: "America/Los_Angeles" },
  { label: "UTC", value: "UTC" },
] as const

/** Default timezone — first entry in TIMEZONE_OPTIONS */
export const DEFAULT_TIMEZONE = TIMEZONE_OPTIONS[0].value

/** Default schedule text for new recurring automations */
export const DEFAULT_SCHEDULE_TEXT = "weekdays at 9am"

/** Max length for schedule_text input (matches API validation) */
export const SCHEDULE_TEXT_MAX_LENGTH = 200
