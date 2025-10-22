import { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk'
import { CheckCircle, XCircle } from 'lucide-react'

interface ResultMessageProps {
  content: SDKResultMessage
}

export function ResultMessage({ content }: ResultMessageProps) {
  return (
    <div className="text-sm my-4">
      <div className={`border rounded-lg p-3 ${
        content.is_error
          ? 'bg-red-50 border-red-200'
          : 'bg-green-50 border-green-200'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 font-medium">
            {content.is_error ? (
              <>
                <XCircle size={16} className="text-red-600" />
                Error
              </>
            ) : (
              <>
                <CheckCircle size={16} className="text-green-600" />
                Completed
              </>
            )}
          </div>
          <div className="text-xs text-gray-600">
            {(content.duration_ms / 1000).toFixed(1)}s • ${content.total_cost_usd.toFixed(4)}
          </div>
        </div>
        {content.result && (
          <div className="text-sm whitespace-pre-wrap">{content.result}</div>
        )}
      </div>
    </div>
  )
}