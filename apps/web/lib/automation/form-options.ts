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
