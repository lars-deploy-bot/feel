import type { ToolProgressContent } from "@/features/chat/lib/message-parser"

interface ToolProgressMessageProps {
  content: ToolProgressContent
}

function formatElapsedTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return `${minutes}m ${remainingSeconds}s`
}

export function ToolProgressMessage({ content }: ToolProgressMessageProps) {
  return (
    <div className="py-1 flex items-center justify-center">
      <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">{content.tool_name}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
            {formatElapsedTime(content.elapsed_time_seconds)}
          </span>
        </div>
      </div>
    </div>
  )
}
