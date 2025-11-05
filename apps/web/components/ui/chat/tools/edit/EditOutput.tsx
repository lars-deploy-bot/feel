interface EditOutputProps {
  replacements?: number
  file_path?: string
  error?: string
}

export function EditOutput({ replacements, file_path, error }: EditOutputProps) {
  if (error) {
    return (
      <div className="text-xs text-red-600 dark:text-red-400 font-normal p-2 bg-red-50/50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
        {error}
      </div>
    )
  }

  const fileName = file_path?.split("/").pop() || "file"

  return (
    <div className="text-xs text-green-700 dark:text-green-400 font-normal p-2 bg-green-50/30 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
      ✓ Made {replacements || 0} {replacements === 1 ? "replacement" : "replacements"} in {fileName}
    </div>
  )
}
