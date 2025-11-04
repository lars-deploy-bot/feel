interface StartMessageProps {
  data: {
    host: string
    cwd: string
    message: string
    messageLength: number
  }
  timestamp: string
}

export function StartMessage({ data }: StartMessageProps) {
  return (
    <div className="py-2 mb-4 text-sm text-black/60">
      <div className="mb-1.5 font-medium normal-case tracking-normal underline">Session Initialized</div>
      <div className="text-xs text-black/50 font-normal normal-case tracking-normal">
        <span className="font-medium">Directory:</span>
        <span className="ml-1">{data.cwd}</span>
      </div>
    </div>
  )
}
