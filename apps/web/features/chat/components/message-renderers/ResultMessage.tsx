import type { SDKResultMessage } from "@anthropic-ai/claude-agent-sdk"
import { useDebugVisible } from "@/lib/dev-mode-context"
import { ErrorCodes, getErrorHelp, getErrorMessage } from "@/lib/error-codes"

interface ResultMessageProps {
  content: SDKResultMessage
}

export function ResultMessage({ content }: ResultMessageProps) {
  // MUST call hooks at top level before any returns
  const isDebugMode = useDebugVisible()

  // Map SDK subtype to error code
  const getErrorCode = () => {
    if (content.subtype === "error_max_turns") {
      return ErrorCodes.ERROR_MAX_TURNS
    }
    return null
  }

  const errorCode = getErrorCode()

  const getDisplayMessage = () => {
    if (errorCode) {
      return getErrorMessage(errorCode)
    }
    return "An error occurred during execution"
  }

  const getDisplayHelp = () => {
    if (errorCode) {
      return getErrorHelp(errorCode)
    }
    return null
  }

  if (content.is_error) {
    return (
      <div className="py-3 mb-4">
        <div className="border border-red-200 bg-red-50/50 p-4 rounded">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-900 mb-1">Execution Error</h3>
              <p className="text-sm text-red-700 leading-relaxed">{getDisplayMessage()}</p>
              {getDisplayHelp() && <p className="text-xs text-red-600 mt-2 leading-relaxed">{getDisplayHelp()}</p>}
              <div className="mt-2 text-xs text-red-500/70">
                Duration: {(content.duration_ms / 1000).toFixed(1)}s • Cost: ${content.total_cost_usd.toFixed(4)}
                {errorCode && <span className="ml-2 font-mono">• {errorCode}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Only show completion stats in debug mode
  if (!isDebugMode) return null

  return (
    <div className="py-2 mb-4">
      <div className="text-sm font-medium text-black/60 normal-case tracking-normal">
        Completed
        <span className="ml-2 text-xs text-black/50 font-normal">
          {(content.duration_ms / 1000).toFixed(1)}s • ${content.total_cost_usd.toFixed(4)}
        </span>
      </div>
    </div>
  )
}
