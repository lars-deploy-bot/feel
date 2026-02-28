/**
 * Automation Job Executor (web-specific)
 *
 * Thin wrapper around the executor module that bridges RunContext → runAutomationJob.
 * Lives in the web app because it depends on web-specific imports (OAuth, worker pool).
 *
 * For the claim/finish lifecycle, use @webalive/automation-engine directly.
 */

import * as Sentry from "@sentry/nextjs"
import {
  persistRunMessage,
  type RunContext,
  shouldPersist,
  updateConversationMetadata,
} from "@webalive/automation-engine"

/**
 * Flush all pending message writes and report failures to Sentry.
 * Returns the number of successfully persisted messages.
 */
async function flushPendingWrites(pendingWrites: Promise<boolean>[], ctx: RunContext): Promise<number> {
  if (pendingWrites.length === 0) return 0

  const settled = await Promise.allSettled(pendingWrites)
  let successCount = 0
  const failures: string[] = []

  for (let i = 0; i < settled.length; i++) {
    const s = settled[i]
    if (s.status === "fulfilled" && s.value) {
      successCount++
    } else {
      const reason = s.status === "rejected" ? String(s.reason) : `persistRunMessage returned false (seq ${i})`
      failures.push(reason)
    }
  }

  if (failures.length > 0) {
    Sentry.withScope(scope => {
      scope.setTag("automation.jobId", ctx.job.id)
      scope.setExtra("failures", failures)
      scope.setExtra("total", pendingWrites.length)
      scope.setExtra("succeeded", successCount)
      Sentry.captureMessage(`[Automation] ${failures.length}/${pendingWrites.length} message writes failed`, "warning")
    })
  }

  return successCount
}

/**
 * Execute a claimed job. Pure execution — calls runAutomationJob.
 * Returns the result without touching DB state (that's finishJob's job).
 */
export async function executeJob(ctx: RunContext): Promise<{
  success: boolean
  durationMs: number
  error?: string
  response?: string
  messages?: unknown[]
  costUsd?: number
  numTurns?: number
  usage?: { input_tokens: number; output_tokens: number }
}> {
  const startTime = Date.now()

  // Hoisted so `finally` can access them even if `try` throws partway through.
  let startSeq = 0
  const pendingWrites: Promise<boolean>[] = []

  try {
    // Build persist callback if we have a tab to write to.
    // The onMessage handler receives raw IPC envelopes like { type: "message", content: <SDK msg> }.
    // We unwrap "message" type to store just the SDK message, matching how the
    // client sync path writes sdk_message content to app.messages.

    // Query the current max seq for this tab to avoid UNIQUE(tab_id, seq) collisions
    // on retries or if another writer has touched the tab.
    if (ctx.chatTabId) {
      const { data } = await ctx.supabase
        .from("messages")
        .select("seq")
        .eq("tab_id", ctx.chatTabId)
        .order("seq", { ascending: false })
        .limit(1)
      if (data && data.length > 0) {
        startSeq = data[0].seq
      }
    }

    const onPersistMessage = ctx.chatTabId
      ? (() => {
          let seq = startSeq
          return (msg: Record<string, unknown>) => {
            // Only persist transcript-relevant messages (assistant, user, result).
            // Filters at both IPC level (skips session/complete) and SDK level
            // (skips system, tool_progress, auth_status, compaction markers).
            if (!shouldPersist(msg)) return

            // shouldPersist narrows msg to PersistableMessage (content: Json).
            // Unwrap to the SDK message (msg.content) for storage.
            const sdkMessage = msg.content
            seq += 1
            pendingWrites.push(
              persistRunMessage({
                supabase: ctx.supabase,
                tabId: ctx.chatTabId!,
                seq,
                sdkMessage,
              }),
            )
          }
        })()
      : undefined

    const { runAutomationJob } = await import("./executor")
    const result = await runAutomationJob({
      jobId: ctx.job.id,
      userId: ctx.job.user_id,
      orgId: ctx.job.org_id,
      workspace: ctx.hostname,
      prompt: ctx.promptOverride ?? ctx.job.action_prompt ?? "",
      timeoutSeconds: ctx.timeoutSeconds,
      model: ctx.job.action_model ?? undefined,
      thinkingPrompt: ctx.job.action_thinking ?? undefined,
      skills: ctx.job.skills ?? undefined,
      systemPromptOverride: ctx.systemPromptOverride,
      extraTools: ctx.extraTools,
      responseToolName: ctx.responseToolName,
      onPersistMessage,
    })

    return {
      success: result.success,
      durationMs: result.durationMs,
      error: result.error,
      response: result.response,
      messages: result.messages,
      costUsd: result.costUsd,
      numTurns: result.numTurns,
      usage: result.usage,
    }
  } catch (error) {
    return {
      success: false,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    // Flush pending message writes before finishJob() runs.
    // In `finally` so partial transcripts from throws are also flushed.
    const successCount = await flushPendingWrites(pendingWrites, ctx)

    // Update conversation/tab metadata with actual persisted count.
    if (successCount > 0 && ctx.chatTabId && ctx.chatConversationId) {
      await updateConversationMetadata({
        supabase: ctx.supabase,
        conversationId: ctx.chatConversationId,
        tabId: ctx.chatTabId,
        messageCount: startSeq + successCount,
      })
    }
  }
}
