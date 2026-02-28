"use client"
import type { BridgeInterruptMessage } from "@/features/chat/lib/streaming/ndjson"
import { useDebugVisible } from "@/lib/stores/debug-store"

interface InterruptMessageProps {
  data: BridgeInterruptMessage["data"]
}

export function InterruptMessage({ data }: InterruptMessageProps) {
  const showDebug = useDebugVisible()
  const text = data.message || "Response interrupted."

  const status = data.status
  const isStopping = status === "stopping" || text.startsWith("Stopping")
  const isStopped = status === "stopped" || text === "Response stopped." || text.includes("interrupted by user")
  const isFinished =
    status === "finished" || text.startsWith("Response already finished") || text === "Response is no longer running."
  const isStillRunning = status === "still_running" || text.startsWith("Stop not confirmed")
  const isNotVerified = status === "not_verified" || text.startsWith("Could not confirm stop")

  // Stopping / stopped / finished — minimal inline treatment
  // These share one DOM structure so CSS transitions work when Dexie updates in place
  if (isStopping || isStopped || isFinished) {
    const label = isStopping ? "Stopping..." : "Stopped"
    const dotClass = isStopping ? "bg-blue-500" : "bg-black/10 dark:bg-white/10"
    const textClass = isStopping ? "text-black/40 dark:text-white/40" : "text-black/30 dark:text-white/30"

    return (
      <div className="py-2">
        <div className="flex items-center gap-2">
          <span className={`size-1.5 rounded-full flex-shrink-0 transition-colors duration-300 ${dotClass}`} />
          <p className={`text-[13px] transition-colors duration-300 ${textClass}`}>{label}</p>
          {showDebug && <span className="text-[10px] font-mono text-black/15 dark:text-white/15">{data.source}</span>}
        </div>
      </div>
    )
  }

  // Warning/error states — follow ErrorResultMessage card pattern
  const dotColor = isStillRunning || isNotVerified ? "bg-amber-500" : "bg-red-500"
  const title = isStillRunning ? "Still running" : isNotVerified ? "Stop not verified" : "Interrupted"

  return (
    <div className="py-2">
      <div className="rounded-lg bg-black/[0.025] dark:bg-white/[0.04] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`size-1.5 rounded-full ${dotColor} flex-shrink-0`} />
          <p className="text-[13px] font-medium text-black/80 dark:text-white/80">{title}</p>
        </div>
        <p className="text-[13px] text-black/45 dark:text-white/45 leading-relaxed mt-1">{text}</p>
        {showDebug && <div className="mt-2 text-[10px] font-mono text-black/20 dark:text-white/20">{data.source}</div>}
      </div>
    </div>
  )
}
