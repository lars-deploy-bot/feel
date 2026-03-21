/**
 * Automation Config Output
 *
 * When Claude calls ask_automation_config, this component opens the Agents tab
 * in the workbench with a pre-filled create form — instead of rendering inline.
 */

"use client"

import { type ClaudeModel, isValidClaudeModel } from "@webalive/shared"
import { ArrowRight } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { AutomationConfigData } from "@/components/ai/AutomationConfig"
import { useWorkbenchContext } from "@/features/chat/lib/workbench-context"
import { useAgentCreateActions } from "@/lib/stores/agentCreateStore"
import { useDebugActions } from "@/lib/stores/debug-store"
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

  if (!("type" in data) || data.type !== "automation_config") return false
  if (!("sites" in data) || !Array.isArray(data.sites)) return false
  if (data.sites.length === 0) return false

  for (const s of data.sites) {
    if (typeof s !== "object" || !s) return false
    if (!("id" in s) || typeof s.id !== "string") return false
    if (!("hostname" in s) || typeof s.hostname !== "string") return false
  }

  return true
}

interface AutomationConfigOutputProps extends ToolResultRendererProps<AutomationConfigToolData> {
  onSubmitAnswer?: (message: string) => void
}

export function AutomationConfigOutput({ data, onSubmitAnswer }: AutomationConfigOutputProps) {
  const [status, setStatus] = useState<"pending" | "opened" | "completed" | "canceled">("pending")
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const hasOpened = useRef(false)

  const { setView } = useWorkbenchContext()
  const { setWorkbench, setWorkbenchMinimized } = useDebugActions()
  const { startCreate } = useAgentCreateActions()

  const defaultModel: ClaudeModel | undefined = isValidClaudeModel(data.defaultModel) ? data.defaultModel : undefined

  const configData = useMemo<AutomationConfigData>(
    () => ({
      sites: data.sites,
      defaultSiteId: data.defaultSiteId,
      context: data.context,
      defaultName: data.defaultName,
      defaultPrompt: data.defaultPrompt,
      defaultModel,
    }),
    [data.sites, data.defaultSiteId, data.context, data.defaultName, data.defaultPrompt, defaultModel],
  )

  const openAgentsPanel = useCallback(() => {
    setWorkbench(true)
    setWorkbenchMinimized(false)

    startCreate(configData, (message: string) => {
      if (message.includes("canceled")) {
        setStatus("canceled")
      } else {
        setStatus("completed")
        setResultMessage(message)
      }
      onSubmitAnswer?.(message)
    })

    setView("agents")
    setStatus("opened")
  }, [setWorkbench, setWorkbenchMinimized, startCreate, configData, setView, onSubmitAnswer])

  // Auto-open on first render
  useEffect(() => {
    if (!hasOpened.current) {
      hasOpened.current = true
      openAgentsPanel()
    }
  }, [openAgentsPanel])

  // Completed
  if (status === "completed") {
    return <p className="mt-2 text-[13px] text-zinc-500 dark:text-zinc-400">{resultMessage}</p>
  }

  // Canceled
  if (status === "canceled") {
    return <p className="mt-2 text-[13px] text-zinc-400 dark:text-zinc-500">Canceled</p>
  }

  // Opened — subtle re-open link
  return (
    <button
      type="button"
      onClick={openAgentsPanel}
      className="group mt-2 inline-flex items-center gap-1.5 text-[13px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors duration-100"
    >
      <span>{data.defaultName ?? "New agent"}</span>
      <ArrowRight
        size={12}
        className="text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 transition-colors duration-100"
      />
    </button>
  )
}
