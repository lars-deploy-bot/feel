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

export function CompleteMessage(_props: CompleteMessageProps) {
  // Don't show completion stats
  return null
}
