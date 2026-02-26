import type { SDKResultMessage } from "@anthropic-ai/claude-agent-sdk"
import { ErrorCodes, getErrorHelp, getErrorMessage } from "@/lib/error-codes"

interface ResultMessageProps {
  content: SDKResultMessage
}

export function ResultMessage({ content }: ResultMessageProps) {
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
      <div className="py-2">
        <div className="rounded-lg bg-black/[0.025] dark:bg-white/[0.04] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-red-500 flex-shrink-0" />
            <p className="text-[13px] font-medium text-black/80 dark:text-white/80">Execution stopped</p>
          </div>
          <p className="text-[13px] text-black/45 dark:text-white/45 leading-relaxed mt-1">{getDisplayMessage()}</p>
          {getDisplayHelp() && (
            <p className="text-[11px] text-black/30 dark:text-white/30 leading-relaxed mt-1.5">{getDisplayHelp()}</p>
          )}
          {errorCode && <div className="mt-2 text-[10px] font-mono text-black/20 dark:text-white/20">{errorCode}</div>}
        </div>
      </div>
    )
  }

  // Never show completion stats
  return null
}
