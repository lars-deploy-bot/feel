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
    <div className="space-y-1">
      <div className="text-xs text-black/60 dark:text-white/60 font-diatype-mono">{fileName}</div>
      <div className="text-xs text-black/40 dark:text-white/40 font-normal">
        {oldLines} → {newLines} {newLines === 1 ? "line" : "lines"}
        {replace_all && " • replace all"}
      </div>
    </div>
  )
}
