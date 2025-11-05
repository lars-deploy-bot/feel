interface WriteOutputProps {
  bytes_written?: number
  file_path?: string
  error?: string
}

export function WriteOutput({ bytes_written, file_path, error }: WriteOutputProps) {
  if (error) {
    return <div className="text-xs text-red-600 font-normal p-2 bg-red-50/50 border border-red-200">{error}</div>
  }

  const fileName = file_path?.split("/").pop() || "file"

  return (
    <div className="text-xs text-blue-700 font-normal p-2 bg-blue-50/30 border border-blue-200">
      ✓ Wrote {bytes_written || 0} bytes to {fileName}
    </div>
  )
}
