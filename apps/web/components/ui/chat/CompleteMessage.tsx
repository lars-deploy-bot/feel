import { Flag } from 'lucide-react'

interface CompleteMessageProps {
  data: {
    totalMessages: number
    result: {
      duration_ms: number
      total_cost_usd: number
      is_error: boolean
    }
  }
}

export function CompleteMessage({ data }: CompleteMessageProps) {
  return (
    <div className="text-sm text-center my-4">
      <div className="bg-gray-100 border rounded-lg px-4 py-2 inline-flex items-center gap-2">
        <Flag size={16} />
        <div className="text-gray-700">
          Session complete • {data.totalMessages} messages •
          {(data.result.duration_ms / 1000).toFixed(1)}s •
          ${data.result.total_cost_usd.toFixed(4)}
        </div>
      </div>
    </div>
  )
}