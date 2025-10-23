interface GlobInputProps {
  pattern: string
  path?: string
}

export function GlobInput({ pattern, path }: GlobInputProps) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-black/60 font-diatype-mono">{pattern}</div>
      {path && <div className="text-xs text-black/40 font-thin">in {path}</div>}
    </div>
  )
}
