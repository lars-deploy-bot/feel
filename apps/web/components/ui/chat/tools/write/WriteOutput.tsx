interface WriteOutputProps {
  bytes_written?: number
  file_path?: string
  error?: string
}

export function WriteOutput({ bytes_written, file_path, error }: WriteOutputProps) {
  if (error) {
    return (
      <div className="text-xs text-red-600 dark:text-red-400 font-normal p-2 bg-red-50/50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
        {error}
      </div>
    )
  }

  const fileName = file_path?.split("/").pop() || "file"

  return (
    <div className="text-xs text-blue-700 dark:text-blue-400 font-normal p-2 bg-blue-50/30 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
      ✓ Wrote {bytes_written || 0} bytes to {fileName}
    </div>
  )
}
