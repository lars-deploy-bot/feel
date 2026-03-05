/**
 * Plan Approval Output
 *
 * Renders the ExitPlanMode tool result when Claude's plan is ready for approval.
 * Shows the plan file path and an "Approve Plan" button.
 * When approved, disables plan mode and sends a confirmation message to Claude.
 */

"use client"

import { Check } from "lucide-react"
import { useCallback, useState } from "react"
import { usePlanModeActions } from "@/lib/stores/streamModeStore"
import type { ToolResultRendererProps } from "@/lib/tools/tool-registry"

/**
 * Expected data format from the ExitPlanMode tool
 * When blocked by canUseTool, we receive the denial message
 */
interface PlanApprovalData {
  /** Whether this is a blocked tool result */
  blocked?: boolean
  /** The plan file path if provided */
  planFile?: string
  /** Whether to launch a swarm */
  launchSwarm?: boolean
  /** Number of teammates for swarm */
  teammateCount?: number
}

/**
 * Type guard to validate this is a plan approval request
 * Returns true if the tool result content indicates ExitPlanMode was blocked
 */
export function validatePlanApproval(data: unknown): data is PlanApprovalData {
  // The data might be the denial message string or a parsed object
  if (typeof data === "string") {
    return data.includes("cannot approve your own plan") || data.includes("Approve Plan")
  }
  return true // Accept any object for ExitPlanMode results
}

interface PlanApprovalOutputProps extends ToolResultRendererProps<PlanApprovalData | string> {
  onSubmitAnswer?: (message: string) => void
}

export function PlanApprovalOutput({ data: _data, onSubmitAnswer }: PlanApprovalOutputProps) {
  const [approved, setApproved] = useState(false)
  const { disablePlanMode } = usePlanModeActions()

  const handleApprove = useCallback(() => {
    setApproved(true)
    // Disable plan mode so Claude can now use modification tools
    disablePlanMode()
    // Send confirmation to Claude
    onSubmitAnswer?.("I approve this plan. Please proceed with the implementation.")
  }, [disablePlanMode, onSubmitAnswer])

  const handleReject = useCallback(() => {
    setApproved(true)
    // Keep plan mode on, but let Claude know to revise
    onSubmitAnswer?.("I'd like you to revise this plan. Please consider alternatives or ask me clarifying questions.")
  }, [onSubmitAnswer])

  // Show completion state
  if (approved) {
    return (
      <div className="flex items-center gap-2 py-2 text-[13px] text-black/60 dark:text-white/60">
        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <span>Plan approved — continuing with implementation</span>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.08] p-4">
      <p className="text-[13px] font-medium text-black/80 dark:text-white/80">Plan Ready for Review</p>
      <p className="mt-1 text-[12px] text-black/40 dark:text-white/40">
        Claude has created a plan and is waiting for your approval before proceeding.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleApprove}
          className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[13px] font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors duration-100"
        >
          Approve Plan
        </button>
        <button
          type="button"
          onClick={handleReject}
          className="px-4 py-2 rounded-lg border border-black/[0.06] dark:border-white/[0.08] text-black/60 dark:text-white/60 text-[13px] font-medium hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors duration-100"
        >
          Request Changes
        </button>
      </div>
    </div>
  )
}
