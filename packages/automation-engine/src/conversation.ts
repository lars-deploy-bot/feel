/**
 * Bootstrap a mirrored conversation + tab for an automation run.
 *
 * Every automation run gets a record in `app.conversations` (source = 'automation_run')
 * and a tab in `app.conversation_tabs`, so run transcripts are discoverable
 * through the normal chat UI.
 *
 * Error handling: logs and returns null — conversation creation must never
 * block run execution.
 */

import { randomUUID } from "node:crypto"
import type { RunContext } from "./types"

export interface BootstrapResult {
  conversationId: string
  tabId: string
}

export async function bootstrapRunConversation(ctx: RunContext): Promise<BootstrapResult | null> {
  const conversationId = randomUUID()
  const tabId = randomUUID()
  const timestamp = new Date(ctx.claimedAt).toISOString()
  const title = `[Auto] ${ctx.job.name} — ${timestamp}`

  try {
    // Insert conversation
    const { error: convError } = await ctx.supabase.from("conversations").insert({
      conversation_id: conversationId,
      user_id: ctx.job.user_id,
      org_id: ctx.job.org_id,
      workspace: ctx.hostname,
      title,
      source: "automation_run",
      source_metadata: {
        job_id: ctx.job.id,
        claim_run_id: ctx.runId,
        triggered_by: ctx.triggeredBy,
      },
      visibility: "private",
    })

    if (convError) {
      console.error(`[Engine] Failed to create conversation for run ${ctx.runId}:`, convError)
      return null
    }

    // Insert tab
    const { error: tabError } = await ctx.supabase.from("conversation_tabs").insert({
      tab_id: tabId,
      conversation_id: conversationId,
      name: "Run",
    })

    if (tabError) {
      console.error(`[Engine] Failed to create conversation tab for run ${ctx.runId}:`, tabError)
      // Clean up the orphaned conversation
      await ctx.supabase.from("conversations").delete().eq("conversation_id", conversationId)
      return null
    }

    return { conversationId, tabId }
  } catch (err) {
    console.error(`[Engine] Unexpected error bootstrapping conversation for run ${ctx.runId}:`, err)
    return null
  }
}
