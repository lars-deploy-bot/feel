interface EditOutputProps {
  replacements?: number
  file_path?: string
  error?: string
}

export function EditOutput({ replacements, file_path, error }: EditOutputProps) {
  if (error) {
    return <div className="text-xs text-red-600 font-normal p-2 bg-red-50/50 border border-red-200">{error}</div>
  }

  const fileName = file_path?.split("/").pop() || "file"

  return (
    <div className="text-xs text-green-700 font-normal p-2 bg-green-50/30 border border-green-200">
      ✓ Made {replacements || 0} {replacements === 1 ? "replacement" : "replacements"} in {fileName}
    </div>
  )
}
