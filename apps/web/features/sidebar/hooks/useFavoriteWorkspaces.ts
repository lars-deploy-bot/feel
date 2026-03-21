"use client"

import { autorun, makeAutoObservable, reaction } from "mobx"
import { useEffect, useState } from "react"
import { logError } from "@/lib/client-error-logger"
import { FAVORITE_WORKSPACES_STORAGE_KEY } from "@/lib/stores/storage-keys"

class FavoriteWorkspacesStore {
  favorites = new Set<string>()

  constructor() {
    makeAutoObservable(this)
    this.load()

    // Persist on every change
    reaction(
      () => [...this.favorites],
      list => localStorage.setItem(FAVORITE_WORKSPACES_STORAGE_KEY, JSON.stringify(list)),
    )
  }

  private load() {
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem(FAVORITE_WORKSPACES_STORAGE_KEY)
      if (!raw) return
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        for (const v of parsed) {
          if (typeof v === "string") this.favorites.add(v)
        }
      }
    } catch (err) {
      logError("sidebar", "Failed to load favorite workspaces from localStorage", {
        error: err instanceof Error ? err : new Error(String(err)),
      })
    }
  }

  toggle = (hostname: string) => {
    if (this.favorites.has(hostname)) {
      this.favorites.delete(hostname)
    } else {
      this.favorites.add(hostname)
    }
  }
}

const store = new FavoriteWorkspacesStore()

/**
 * Workspace-level favorites. MobX store — shared across all components.
 * Uses autorun to bridge MobX reactivity → React state.
 * No `observer()` wrapper needed on consumers.
 */
export function useFavoriteWorkspaces() {
  const [favorites, setFavorites] = useState(() => new Set(store.favorites))

  useEffect(() => {
    let first = true
    return autorun(() => {
      // Reading store.favorites inside autorun subscribes to it
      const next = new Set(store.favorites)
      if (first) {
        first = false
        return
      }
      setFavorites(next)
    })
  }, [])

  return { favorites, toggle: store.toggle }
}
