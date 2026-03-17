"use client"

import { useCallback, useState } from "react"
import type { DbConversation } from "@/lib/db/messageDb"

/**
 * Drag-and-drop handlers for moving conversations between favorites and ungrouped zones.
 */
export function useFavoriteDragDrop(
  conversations: DbConversation[],
  favorites: ReadonlySet<string>,
  toggleFavoriteWorkspace: (ws: string) => void,
  setConversationFavorited: (id: string, favorited: boolean) => Promise<void>,
) {
  const [dragOverZone, setDragOverZone] = useState<"favorites" | "below" | null>(null)

  const extractDropId = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOverZone(null)
    return e.dataTransfer.getData("text/plain")
  }, [])

  const handleDropFavorites = useCallback(
    (e: React.DragEvent) => {
      const id = extractDropId(e)
      if (!id) return
      setConversationFavorited(id, true)
      const conversation = conversations.find(c => c.id === id)
      if (conversation && !favorites.has(conversation.workspace)) {
        toggleFavoriteWorkspace(conversation.workspace)
      }
    },
    [extractDropId, setConversationFavorited, conversations, favorites, toggleFavoriteWorkspace],
  )

  const handleDropBelow = useCallback(
    (e: React.DragEvent) => {
      const id = extractDropId(e)
      if (!id) return
      setConversationFavorited(id, false)
    },
    [extractDropId, setConversationFavorited],
  )

  const handleDragOverFavorites = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverZone("favorites")
  }, [])

  const handleDragOverBelow = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverZone("below")
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverZone(null)
  }, [])

  return {
    dragOverZone,
    handleDropFavorites,
    handleDropBelow,
    handleDragOverFavorites,
    handleDragOverBelow,
    handleDragLeave,
  }
}
