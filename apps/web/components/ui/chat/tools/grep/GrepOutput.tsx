type GrepOutputProps = GrepContentOutputProps | GrepFilesOutputProps | GrepCountOutputProps

interface GrepContentOutputProps {
  matches: Array<{
    file: string
    line_number?: number
    line: string
    before_context?: string[]
    after_context?: string[]
  }>
  total_matches: number
}

interface GrepFilesOutputProps {
  files: string[]
  count: number
}

interface GrepCountOutputProps {
  counts: Array<{
    file: string
    count: number
  }>
  total: number
}

export function GrepOutput(props: GrepOutputProps) {
  // Content output (matching lines)
  if ("matches" in props && "total_matches" in props) {
    return (
      <div className="space-y-2">
        <div className="text-xs text-black/40 dark:text-white/40 font-thin">{props.total_matches} matches</div>
        <div className="space-y-3 max-h-80 overflow-auto">
          {props.matches.map((match, index) => (
            <div key={index} className="space-y-1">
              <div className="text-xs text-black/50 dark:text-white/50 font-thin">
                {match.file.split("/").pop()} {match.line_number && `:${match.line_number}`}
              </div>
              {match.before_context?.map((line, i) => (
                <div key={`before-${i}`} className="text-xs text-black/30 dark:text-white/30 font-diatype-mono pl-2">
                  {line}
                </div>
              ))}
              <div className="text-xs text-black/80 dark:text-white/80 font-diatype-mono pl-2 bg-yellow-50 dark:bg-yellow-900/30">
                {match.line}
              </div>
              {match.after_context?.map((line, i) => (
                <div key={`after-${i}`} className="text-xs text-black/30 dark:text-white/30 font-diatype-mono pl-2">
                  {line}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Files output (just file names)
  if ("files" in props && "count" in props) {
    return (
      <div className="space-y-2">
        <div className="text-xs text-black/40 dark:text-white/40 font-thin">{props.count} files</div>
        <div className="space-y-1 max-h-80 overflow-auto">
          {props.files.map((file, index) => (
            <div key={index} className="text-xs text-black/60 dark:text-white/60 font-diatype-mono">
              {file}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Count output (counts per file)
  if ("counts" in props && "total" in props) {
    return (
      <div className="space-y-2">
        <div className="text-xs text-black/40 dark:text-white/40 font-thin">{props.total} total matches</div>
        <div className="space-y-1 max-h-80 overflow-auto">
          {props.counts.map((count, index) => (
            <div
              key={index}
              className="text-xs text-black/60 dark:text-white/60 font-diatype-mono flex justify-between"
            >
              <span>{count.file}</span>
              <span className="text-black/40 dark:text-white/40">{count.count}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}
