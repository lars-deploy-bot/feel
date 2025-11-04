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
    <div className="py-2 mb-4 text-center">
      <div className="text-sm font-medium text-black/60 normal-case tracking-normal">
        Session complete
        <span className="ml-2 text-xs text-black/50 font-normal">
          {data.totalMessages} messages • {(data.result.duration_ms / 1000).toFixed(1)}s • $
          {data.result.total_cost_usd.toFixed(4)}
        </span>
      </div>
    </div>
  )
}
