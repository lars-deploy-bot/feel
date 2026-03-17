"use client"

import { useEffect, useMemo, useRef } from "react"
import { useAuth } from "@/features/deployment/hooks/useAuth"
import { trackSidebarClosed, trackSidebarOpened } from "@/lib/analytics/events"
import { logError } from "@/lib/client-error-logger"
import { fetchConversations } from "@/lib/db/conversationSync"
import {
  useDexieAllArchivedConversations,
  useDexieAllConversations,
  useDexieMessageActions,
  useDexieSession,
} from "@/lib/db/dexieMessageStore"
import { useOrganizations } from "@/lib/hooks/useOrganizations"
import { useSidebarOpen } from "../sidebarStore"
import { useFavoriteWorkspaces } from "./useFavoriteWorkspaces"

/** Derive a display name from the user object (first available of firstName, name, email prefix). */
function deriveUserDisplay(
  user: { firstName?: string | null; name?: string | null; email?: string | null } | null,
): string | null {
  if (!user) return null
  if (user.firstName) return user.firstName
  if (user.name) return user.name
  if (user.email) return user.email.split("@")[0]
  return null
}

/**
 * Loads all conversation data the sidebar needs:
 * - session, user, conversations, archived, favorites, message actions
 * - Fires server sync on session init
 * - Tracks sidebar open/close analytics
 */
export function useConversationData() {
  const isOpen = useSidebarOpen()
  const session = useDexieSession()
  const { user } = useAuth()
  const { organizations } = useOrganizations()
  const orgIds = useMemo(() => new Set(organizations.map(o => o.org_id)), [organizations])
  const conversations = useDexieAllConversations(session, orgIds)
  const archivedConversations = useDexieAllArchivedConversations(session)
  const { favorites, toggle: toggleFavoriteWorkspace } = useFavoriteWorkspaces()
  const { setConversationFavorited } = useDexieMessageActions()

  // Pull conversations from server (cross-workspace) on session init.
  // fetchConversations handles its own errors internally via logError.
  useEffect(() => {
    if (session?.userId && session?.orgId) {
      fetchConversations(session.userId, session.orgId).catch((err: unknown) => {
        logError("sidebar", "Unexpected fetchConversations failure", {
          error: err instanceof Error ? err : new Error(String(err)),
        })
      })
    }
  }, [session?.userId, session?.orgId])

  // Track sidebar open/close (skip initial false → closed on mount)
  const didInitRef = useRef(false)
  useEffect(() => {
    if (isOpen) {
      trackSidebarOpened()
    } else if (didInitRef.current) {
      trackSidebarClosed()
    }
    didInitRef.current = true
  }, [isOpen])

  const userDisplay = deriveUserDisplay(user)

  return {
    conversations,
    archivedConversations,
    favorites,
    toggleFavoriteWorkspace,
    setConversationFavorited,
    userDisplay,
  }
}
