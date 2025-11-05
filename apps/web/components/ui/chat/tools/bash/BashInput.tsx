interface BashInputProps {
  command: string
  description?: string
  timeout?: number
  run_in_background?: boolean
}

export function BashInput({ command, description, timeout, run_in_background }: BashInputProps) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-black/60 dark:text-white/60 font-diatype-mono">{command}</div>
      {description && <div className="text-xs text-black/40 dark:text-white/40 font-thin">{description}</div>}
      {(timeout || run_in_background) && (
        <div className="text-xs text-black/30 dark:text-white/30 font-thin">
          {run_in_background && "background"} {timeout && `timeout: ${timeout}ms`}
        </div>
      )}
    </div>
  )
}
