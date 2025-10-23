interface ReadInputProps {
  file_path: string
  offset?: number
  limit?: number
}

export function ReadInput({ file_path, offset, limit }: ReadInputProps) {
  const fileName = file_path.split("/").pop() || file_path

  return (
    <div className="space-y-1">
      <div className="text-xs text-black/60 font-diatype-mono">{fileName}</div>
      {(offset || limit) && (
        <div className="text-xs text-black/40 font-thin">
          {offset && `from line ${offset}`} {limit && `• ${limit} lines`}
        </div>
      )}
    </div>
  )
}
