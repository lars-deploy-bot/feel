import { Bot } from "lucide-react"

export function ReadOnlyTranscriptBar() {
  return (
    <div
      className="px-4 py-3 text-center text-sm text-black/40 dark:text-white/40 border-t border-black/[0.04] dark:border-white/[0.06]"
      data-testid="readonly-transcript-bar"
    >
      <span className="inline-flex items-center gap-1.5">
        <Bot size={14} strokeWidth={1.75} />
        Read-only automation transcript
      </span>
    </div>
  )
}
