"use client"

import { useEffect, useMemo, useState } from "react"
import type { DbConversation } from "@/lib/db/messageDb"
import { AUTOMATION_RUN_SOURCE } from "@/lib/db/messageDb"
import type { WorkspaceGroup } from "../types"

/**
 * Groups all conversations by workspace.
 * Favorite workspaces appear first, non-favorites after.
 * Archived conversations are shown in the Info panel, not here.
 */
export function useConversationGroups(
  conversations: DbConversation[],
  favorites: ReadonlySet<string>,
  currentWorkspace: string | null,
) {
  const workspaceGroups = useMemo(() => {
    // Group active conversations by workspace
    const activeByWs = new Map<string, DbConversation[]>()
    for (const c of conversations) {
      if (c.source === AUTOMATION_RUN_SOURCE) continue
      const list = activeByWs.get(c.workspace) ?? []
      list.push(c)
      activeByWs.set(c.workspace, list)
    }

    // Collect all workspaces that should appear
    const allWorkspaces = new Set<string>()
    for (const ws of favorites) allWorkspaces.add(ws)
    for (const ws of activeByWs.keys()) allWorkspaces.add(ws)

    // Build groups
    const groups: WorkspaceGroup[] = []
    for (const ws of allWorkspaces) {
      groups.push({
        workspace: ws,
        isFavorite: favorites.has(ws),
        conversations: activeByWs.get(ws) ?? [],
        archivedConversations: [],
      })
    }

    // Sort: favorites first (alphabetically), then non-favorites (alphabetically)
    groups.sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
      return a.workspace.localeCompare(b.workspace)
    })

    return groups
  }, [conversations, favorites])

  // Expanded/collapsed workspace state
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(() => new Set())

  const toggleExpanded = (ws: string) => {
    setExpandedWorkspaces(prev => {
      const next = new Set(prev)
      if (next.has(ws)) next.delete(ws)
      else next.add(ws)
      return next
    })
  }

  // Auto-expand current workspace
  useEffect(() => {
    if (currentWorkspace) {
      setExpandedWorkspaces(prev => {
        if (prev.has(currentWorkspace)) return prev
        return new Set([...prev, currentWorkspace])
      })
    }
  }, [currentWorkspace])

  return {
    workspaceGroups,
    expandedWorkspaces,
    toggleExpanded,
  }
}
