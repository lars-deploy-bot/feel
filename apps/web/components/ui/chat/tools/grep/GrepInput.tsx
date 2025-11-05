interface GrepInputProps {
  pattern: string
  path?: string
  glob?: string
  type?: string
  output_mode?: "content" | "files_with_matches" | "count"
  "-i"?: boolean
  "-n"?: boolean
  "-A"?: number
  "-B"?: number
  "-C"?: number
  multiline?: boolean
  head_limit?: number
}

export function GrepInput({
  pattern,
  path,
  glob,
  type,
  output_mode = "files_with_matches",
  ...options
}: GrepInputProps) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-black/60 dark:text-white/60 font-diatype-mono">{pattern}</div>
      <div className="text-xs text-black/40 dark:text-white/40 font-thin space-x-2">
        {glob && <span>in {glob}</span>}
        {type && <span>• {type} files</span>}
        {output_mode !== "files_with_matches" && <span>• {output_mode}</span>}
        {options["-i"] && <span>• case insensitive</span>}
        {options["-n"] && <span>• line numbers</span>}
        {(options["-A"] || options["-B"] || options["-C"]) && <span>• context</span>}
        {options.multiline && <span>• multiline</span>}
        {options.head_limit && <span>• limit {options.head_limit}</span>}
      </div>
    </div>
  )
}
