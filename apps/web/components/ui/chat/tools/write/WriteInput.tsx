interface WriteInputProps {
  file_path: string
  content: string
}

export function WriteInput({ file_path, content }: WriteInputProps) {
  const fileName = file_path.split("/").pop() || file_path
  const lines = content.split("\n").length

  return (
    <div className="space-y-1">
      <div className="text-xs text-black/60 dark:text-white/60 font-diatype-mono">{fileName}</div>
      <div className="text-xs text-black/40 dark:text-white/40 font-normal">
        {lines} {lines === 1 ? "line" : "lines"}
      </div>
    </div>
  )
}
