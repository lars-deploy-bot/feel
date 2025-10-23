interface GlobOutputProps {
  matches: string[]
  count: number
  search_path: string
}

export function GlobOutput({ matches, count, search_path }: GlobOutputProps) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-black/40 font-thin">
        {count} matches in {search_path}
      </div>
      <div className="space-y-1 max-h-80 overflow-auto">
        {matches.map((match, index) => (
          <div key={index} className="text-xs text-black/60 font-diatype-mono">
            {match}
          </div>
        ))}
      </div>
    </div>
  )
}
