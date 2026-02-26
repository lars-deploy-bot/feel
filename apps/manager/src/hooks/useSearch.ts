import { useMemo, useState } from "react"

export function useSearch<T>(items: T[], searchFn: (item: T, query: string) => boolean) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter(item => searchFn(item, q))
  }, [items, query, searchFn])

  return { query, setQuery, filtered }
}
