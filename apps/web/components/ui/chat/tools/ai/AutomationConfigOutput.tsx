/**
 * Automation Config Output
 *
 * Renders the ask_automation_config tool result as an interactive form.
 * The form creates the automation directly via API, then sends Claude
 * an informational confirmation message.
 */

"use client"

import { type ClaudeModel, isValidClaudeModel } from "@webalive/shared"
import { useCallback, useState } from "react"
import {
  AutomationConfig,
  type AutomationConfigData,
  type AutomationConfigResult,
} from "@/components/ai/AutomationConfig"
import { ApiError, postty } from "@/lib/api/api-client"
import { buildCreatePayload, configResultToFormData } from "@/lib/automation/build-payload"
import type { ToolResultRendererProps } from "@/lib/tools/tool-registry"

/**
 * Expected data format from the ask_automation_config tool
 */
interface AutomationConfigToolData {
  type: "automation_config"
  sites: Array<{
    id: string
    hostname: string
  }>
  defaultSiteId?: string
  context?: string
  defaultName?: string
  defaultPrompt?: string
  defaultModel?: string
}

/**
 * Type guard to validate the tool output
 */
export function validateAutomationConfig(data: unknown): data is AutomationConfigToolData {
  if (!data || typeof data !== "object") return false
  const d = data as Record<string, unknown>

  if (d.type !== "automation_config") return false
  if (!Array.isArray(d.sites)) return false
  if (d.sites.length === 0) return false

  for (const s of d.sites) {
    if (typeof s !== "object" || !s) return false
    const site = s as Record<string, unknown>
    if (typeof site.id !== "string") return false
    if (typeof site.hostname !== "string") return false
  }

  return true
}

function formatScheduleDescription(result: AutomationConfigResult): string {
  switch (result.scheduleType) {
    case "once":
      return `Once on ${result.scheduleDate} at ${result.scheduleTime}`
    case "daily":
      return `Daily at ${result.scheduleTime} (${result.timezone})`
    case "weekly":
      return `Weekly at ${result.scheduleTime} (${result.timezone})`
    case "monthly":
      return `Monthly at ${result.scheduleTime} (${result.timezone})`
    case "custom":
      return `Cron: ${result.cronExpression} (${result.timezone})`
  }
}

function formatAutomationCreatedMessage(result: AutomationConfigResult): string {
  const schedule = formatScheduleDescription(result)
  return `Automation "${result.name}" created successfully for ${result.siteName}. Schedule: ${schedule}`
}

interface AutomationConfigOutputProps extends ToolResultRendererProps<AutomationConfigToolData> {
  onSubmitAnswer?: (message: string) => void
}

export function AutomationConfigOutput({ data, onSubmitAnswer }: AutomationConfigOutputProps) {
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "canceled">("idle")
  const [submittedResult, setSubmittedResult] = useState<AutomationConfigResult | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const defaultModel: ClaudeModel | undefined = isValidClaudeModel(data.defaultModel) ? data.defaultModel : undefined

  const configData: AutomationConfigData = {
    sites: data.sites,
    defaultSiteId: data.defaultSiteId,
    context: data.context,
    defaultName: data.defaultName,
    defaultPrompt: data.defaultPrompt,
    defaultModel,
  }

  const handleComplete = useCallback(
    async (result: AutomationConfigResult) => {
      if (status === "submitting") return

      setSubmitError(null)
      setStatus("submitting")

      try {
        const request = buildCreatePayload(configResultToFormData(result))
        await postty("automations/create", request)

        setSubmittedResult(result)
        setStatus("submitted")
        onSubmitAnswer?.(formatAutomationCreatedMessage(result))
      } catch (error) {
        setStatus("idle")
        if (error instanceof ApiError) {
          setSubmitError(error.message)
          return
        }
        setSubmitError(error instanceof Error ? error.message : "Failed to create automation")
      }
    },
    [onSubmitAnswer, status],
  )

  const handleCancel = useCallback(() => {
    setSubmitError(null)
    setStatus("canceled")
    onSubmitAnswer?.("User canceled automation configuration.")
  }, [onSubmitAnswer])

  if (status === "submitted" || status === "canceled") {
    return (
      <div className="mt-2 p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
        <p className="text-xs text-black/50 dark:text-white/50">{status === "canceled" ? "Canceled" : "Created"}</p>
        {submittedResult && status === "submitted" && (
          <div className="mt-2 space-y-1">
            <div className="text-xs">
              <span className="text-black/40 dark:text-white/40">Task: </span>
              <span className="text-black/70 dark:text-white/70">{submittedResult.name}</span>
            </div>
            <div className="text-xs">
              <span className="text-black/40 dark:text-white/40">Website: </span>
              <span className="text-black/70 dark:text-white/70">{submittedResult.siteName}</span>
            </div>
            <div className="text-xs">
              <span className="text-black/40 dark:text-white/40">Schedule: </span>
              <span className="text-black/70 dark:text-white/70">{formatScheduleDescription(submittedResult)}</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mt-2">
      {status === "submitting" && (
        <div className="mb-2 rounded-lg border border-black/5 bg-black/[0.02] px-3 py-2 text-xs text-black/50 dark:border-white/5 dark:bg-white/[0.02] dark:text-white/50">
          Creating automation...
        </div>
      )}
      {submitError && (
        <div
          className="mb-2 rounded-lg border border-red-200/60 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:border-red-700/40 dark:text-red-400"
          role="alert"
        >
          {submitError}
        </div>
      )}
      <div
        className={status === "submitting" ? "pointer-events-none opacity-50" : ""}
        aria-busy={status === "submitting"}
      >
        <AutomationConfig data={configData} onComplete={handleComplete} onCancel={handleCancel} />
      </div>
    </div>
  )
}
