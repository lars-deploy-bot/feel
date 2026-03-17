"use client"

import { useEffect, useMemo, useState } from "react"
import type { DbConversation } from "@/lib/db/messageDb"
import { AUTOMATION_RUN_SOURCE } from "@/lib/db/messageDb"
import type { WorkspaceGroup } from "../types"

/**
 * Splits conversations into favorite workspace groups and ungrouped active list.
 * Manages expanded/collapsed state per workspace, auto-expands current workspace.
 */
export function useConversationGroups(
  conversations: DbConversation[],
  favorites: ReadonlySet<string>,
  currentWorkspace: string | null,
) {
  const favoriteWorkspaces = useMemo(() => [...favorites].sort(), [favorites])

  const { favoriteGroups, activeConversations } = useMemo(() => {
    const favByWs = new Map<string, DbConversation[]>()
    const active: DbConversation[] = []

    for (const ws of favoriteWorkspaces) {
      favByWs.set(ws, [])
    }

    for (const c of conversations) {
      if (c.source === AUTOMATION_RUN_SOURCE) continue

      const wsBucket = favByWs.get(c.workspace)
      if (c.favorited && wsBucket) {
        wsBucket.push(c)
      } else {
        active.push(c)
      }
    }

    const groups: WorkspaceGroup[] = favoriteWorkspaces.map(ws => ({
      workspace: ws,
      conversations: favByWs.get(ws) ?? [],
    }))

    return { favoriteGroups: groups, activeConversations: active }
  }, [conversations, favoriteWorkspaces])

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
    favoriteGroups,
    activeConversations,
    expandedWorkspaces,
    toggleExpanded,
  }
}
