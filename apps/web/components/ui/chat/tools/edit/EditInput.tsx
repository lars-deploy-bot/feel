interface EditInputProps {
  file_path: string
  old_string: string
  new_string: string
  replace_all?: boolean
}

export function EditInput({ file_path, old_string, new_string, replace_all }: EditInputProps) {
  const fileName = file_path.split("/").pop() || file_path
  const oldLines = old_string.split("\n").length
  const newLines = new_string.split("\n").length

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <div className="text-black/60 dark:text-white/60 font-diatype-mono">{fileName}</div>
        <div className="text-black/40 dark:text-white/40 font-normal">
          {oldLines} → {newLines} {newLines === 1 ? "line" : "lines"}
          {replace_all && " • replace all"}
        </div>
      </div>

      <div className="text-black/50 dark:text-white/50 font-mono text-[10px] break-all">{file_path}</div>

      <div className="space-y-2">
        <div>
          <div className="text-black/50 dark:text-white/50 mb-1">Removed:</div>
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded p-2 text-red-700 dark:text-red-300 font-mono text-[10px] whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
            {old_string}
          </div>
        </div>

        <div>
          <div className="text-black/50 dark:text-white/50 mb-1">Added:</div>
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded p-2 text-green-700 dark:text-green-300 font-mono text-[10px] whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
            {new_string}
          </div>
        </div>
      </div>
    </div>
  )
}
