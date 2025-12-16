interface BashOutputProps {
  output: string
  exitCode: number
  killed?: boolean
  shellId?: string
}

// Strip ANSI escape codes from terminal output
function stripAnsi(str: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Required to match ANSI escape sequences
  return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "")
}

export function BashOutput({ output, exitCode, killed, shellId }: BashOutputProps) {
  const getStatusText = () => {
    if (killed) return "killed (timeout)"
    return exitCode === 0 ? "completed" : `failed (${exitCode})`
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-black/40 dark:text-white/40 font-normal">
        {getStatusText()} {shellId && `• shell ${shellId}`}
      </div>
      {output && (
        <div className="text-xs text-black/80 dark:text-white/80 font-diatype-mono leading-relaxed whitespace-pre-wrap bg-black/[0.02] dark:bg-white/[0.02] p-3 border border-black/10 dark:border-white/10 max-h-80 overflow-auto">
          {stripAnsi(output)}
        </div>
      )}
    </div>
  )
}
