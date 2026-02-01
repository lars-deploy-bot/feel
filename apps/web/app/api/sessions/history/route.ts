/**
 * Sessions History API
 *
 * GET /api/sessions/history?sessionKey=...&limit=50&includeTools=false
 *
 * Fetches conversation history from a session.
 * Used by sessions_history tool.
 */

import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/features/auth/lib/auth"
import { createIamClient } from "@/lib/supabase/iam"
import { createAppClient } from "@/lib/supabase/app"
import type { SessionMessage } from "@alive-brug/tools"

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = user.id

    const { searchParams } = new URL(req.url)
    const sessionKey = searchParams.get("sessionKey")
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const _includeTools = searchParams.get("includeTools") === "true"
    const _after = searchParams.get("after")

    if (!sessionKey) {
      return NextResponse.json({ error: "sessionKey is required" }, { status: 400 })
    }

    // Parse session key
    const parts = sessionKey.split("::")
    if (parts.length !== 4) {
      return NextResponse.json({ error: "Invalid session key format" }, { status: 400 })
    }

    const [targetUserId, targetWorkspace, _tabGroupId, targetTabId] = parts

    // For now, only allow reading own sessions
    // TODO: Implement A2A policy for cross-user access
    if (targetUserId !== userId) {
      return NextResponse.json(
        {
          error: "Cross-user session history not yet implemented",
        },
        { status: 403 },
      )
    }

    // Get domain ID
    const app = await createAppClient("service")
    const { data: domain } = await app.from("domains").select("domain_id").eq("hostname", targetWorkspace).single()

    if (!domain) {
      return NextResponse.json(
        {
          sessionKey,
          messages: [],
          count: 0,
          error: `Workspace not found: ${targetWorkspace}`,
        },
        { status: 404 },
      )
    }

    // Get session
    const iam = await createIamClient("service")
    const { data: session } = await iam
      .from("sessions")
      .select("sdk_session_id")
      .eq("user_id", targetUserId)
      .eq("domain_id", domain.domain_id)
      .eq("tab_id", targetTabId)
      .single()

    if (!session) {
      return NextResponse.json({
        sessionKey,
        messages: [],
        count: 0,
      })
    }

    // TODO: Fetch actual messages from Claude SDK session
    // The Claude SDK stores conversation history in its session.
    // We would need to:
    // 1. Load the session using Anthropic SDK
    // 2. Get the messages from the session
    // 3. Filter by includeTools and after params
    //
    // For now, return empty - actual implementation requires SDK integration

    const messages: SessionMessage[] = []

    return NextResponse.json({
      sessionKey,
      messages,
      count: messages.length,
      note: "Session history retrieval is in development. SDK integration pending.",
    })
  } catch (err) {
    console.error("[Sessions History API] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
