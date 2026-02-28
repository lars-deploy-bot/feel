"use client"

import { useCallback, useState } from "react"

const FAVORITES_KEY = "alive:favorite-projects"

function readFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((v): v is string => typeof v === "string"))
  } catch {
    return new Set()
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(readFavorites)

  const toggle = useCallback((hostname: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(hostname)) {
        next.delete(hostname)
      } else {
        next.add(hostname)
      }
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])

  return { favorites, toggle }
}
