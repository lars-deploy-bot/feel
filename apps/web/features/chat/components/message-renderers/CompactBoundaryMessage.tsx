import { useDebugVisible } from "@/lib/dev-mode-context"

interface CompactBoundaryMessageProps {
  data: {
    session_id: string
    uuid: string
    compact_metadata?: {
      trigger: string
      pre_tokens: number
    }
  }
}

export function CompactBoundaryMessage({ data }: CompactBoundaryMessageProps) {
  const isDebugMode = useDebugVisible()

  return (
    <div className="py-3 mb-4 flex items-center justify-center">
      <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-blue-600 dark:text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
            />
          </svg>
          <div className="text-sm text-blue-800 dark:text-blue-200 font-medium">Context compacted</div>
        </div>
        {isDebugMode && data.compact_metadata && (
          <div className="text-xs text-blue-600 dark:text-blue-400 font-mono">
            {data.compact_metadata.pre_tokens.toLocaleString()} tokens
          </div>
        )}
      </div>
    </div>
  )
}
