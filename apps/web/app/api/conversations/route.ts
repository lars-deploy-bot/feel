/**
 * Conversations API
 *
 * GET: Fetch user's conversations, optionally filtered by workspace.
 * Supports cursor-based pagination for cross-workspace unified sidebar.
 */

import * as Sentry from "@sentry/nextjs"
import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { handleQuery, isHandleBodyError } from "@/lib/api/server"
import { normalizeConversationSourcePayload } from "@/lib/conversations/source"
import { ErrorCodes } from "@/lib/error-codes"
import { createRLSAppClient } from "@/lib/supabase/server-rls"

// =============================================================================
// GET /api/conversations?workspace=xxx&limit=50&cursor=xxx
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }
    const userId = user.id

    const query = await handleQuery("conversations/list", request)
    if (isHandleBodyError(query)) return query
    const { workspace, limit, cursor } = query

    const supabase = await createRLSAppClient()

    // Build query — RLS guarantees only user-owned and shared-in-org records.
    // workspace is optional: omit for cross-workspace unified sidebar.
    let q = supabase
      .from("conversations")
      .select(`
        conversation_id,
        workspace,
        org_id,
        user_id,
        title,
        visibility,
        message_count,
        last_message_at,
        first_user_message_id,
        auto_title_set,
        created_at,
        updated_at,
        deleted_at,
        archived_at,
        source,
        source_metadata,
        conversation_tabs (
          tab_id,
          conversation_id,
          name,
          position,
          message_count,
          last_message_at,
          created_at,
          closed_at,
          draft
        )
      `)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(limit + 1) // Fetch one extra to detect hasMore

    if (workspace) {
      q = q.eq("workspace", workspace)
    }

    if (cursor) {
      q = q.lt("updated_at", cursor)
    }

    const { data: conversations, error } = await q

    if (error) {
      Sentry.captureException(error, { extra: { context: "conversations fetch" } })
      return structuredErrorResponse(ErrorCodes.QUERY_FAILED, { status: 500 })
    }

    // After the error guard, Supabase guarantees conversations is non-null
    if (!conversations) throw new Error("Supabase returned null data without error")

    // Detect pagination
    const hasMore = conversations.length > limit
    const page = hasMore ? conversations.slice(0, limit) : conversations
    const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].updated_at : null

    // Transform to client format
    const transform = (c: NonNullable<typeof conversations>[number], isOwn: boolean) => {
      const normalizedSource = normalizeConversationSourcePayload(c.source, c.source_metadata)

      return {
        id: c.conversation_id,
        workspace: c.workspace,
        orgId: c.org_id,
        creatorId: isOwn ? userId : c.user_id,
        title: c.title,
        visibility: c.visibility,
        messageCount: c.message_count,
        lastMessageAt: c.last_message_at ? new Date(c.last_message_at).getTime() : null,
        firstUserMessageId: c.first_user_message_id,
        autoTitleSet: c.auto_title_set,
        createdAt: new Date(c.created_at).getTime(),
        updatedAt: new Date(c.updated_at).getTime(),
        deletedAt: c.deleted_at ? new Date(c.deleted_at).getTime() : null,
        archivedAt: c.archived_at ? new Date(c.archived_at).getTime() : null,
        source: normalizedSource.source,
        sourceMetadata: normalizedSource.sourceMetadata,
        tabs: (c.conversation_tabs || []).map(t => ({
          id: t.tab_id,
          conversationId: t.conversation_id,
          name: t.name,
          position: t.position,
          messageCount: t.message_count,
          lastMessageAt: t.last_message_at ? new Date(t.last_message_at).getTime() : null,
          createdAt: new Date(t.created_at).getTime(),
          closedAt: t.closed_at ? new Date(t.closed_at).getTime() : null,
          draft: isOwn ? (t.draft ?? null) : null,
        })),
      }
    }

    const own = page.filter(c => c.user_id === userId)
    const shared = page.filter(c => c.user_id !== userId)

    return NextResponse.json({
      own: own.map(c => transform(c, true)),
      shared: shared.map(c => transform(c, false)),
      hasMore,
      nextCursor,
    })
  } catch (error) {
    console.error("[conversations] Unexpected error:", error)
    Sentry.captureException(error)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }
}
