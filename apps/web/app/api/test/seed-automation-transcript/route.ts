/**
 * Seed automation transcript data for E2E tests.
 *
 * Creates:
 * - app.automation_runs row in "running" state
 * - app.conversations row with source="automation_run"
 * - app.conversation_tabs row named "Run"
 * - app.messages row with one assistant sdk_message
 *
 * This endpoint exists only for test/local environments (or with x-test-secret).
 */

import { randomUUID } from "node:crypto"
import type { AppDatabase } from "@webalive/database"
import { env } from "@webalive/env/server"
import { structuredErrorResponse } from "@/lib/api/responses"
import { ErrorCodes } from "@/lib/error-codes"
import { createServiceAppClient } from "@/lib/supabase/service"
import {
  CleanupAutomationTranscriptRequestSchema,
  CleanupAutomationTranscriptResponseSchema,
  SeedAutomationTranscriptRequestSchema,
  SeedAutomationTranscriptResponseSchema,
} from "@/lib/testing/e2e-automation-transcript"

type AutomationRunInsert = AppDatabase["app"]["Tables"]["automation_runs"]["Insert"]
type ConversationInsert = AppDatabase["app"]["Tables"]["conversations"]["Insert"]
type ConversationTabInsert = AppDatabase["app"]["Tables"]["conversation_tabs"]["Insert"]
type MessageInsert = AppDatabase["app"]["Tables"]["messages"]["Insert"]
type AutomationJobUpdate = AppDatabase["app"]["Tables"]["automation_jobs"]["Update"]

function isTestEndpointAuthorized(req: Request): boolean {
  const isTestEnv = env.NODE_ENV === "test" || env.STREAM_ENV === "local"
  const testSecret = req.headers.get("x-test-secret")
  const expectedSecret = env.E2E_TEST_SECRET
  const hasValidSecret = Boolean(expectedSecret && testSecret === expectedSecret)
  return isTestEnv || hasValidSecret
}

function validationError(message: string): Response {
  return structuredErrorResponse(ErrorCodes.VALIDATION_ERROR, {
    status: 400,
    details: { message },
  })
}

export async function POST(req: Request) {
  if (!isTestEndpointAuthorized(req)) {
    return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 404 })
  }

  const parsed = SeedAutomationTranscriptRequestSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return validationError("Invalid request body for seed-automation-transcript")
  }

  const { jobId, initialMessage = "Starting automation..." } = parsed.data
  const app = createServiceAppClient()

  const { data: job, error: jobError } = await app
    .from("automation_jobs")
    .select("id, name, site_id, user_id")
    .eq("id", jobId)
    .single()

  if (jobError || !job) {
    return structuredErrorResponse(ErrorCodes.AUTOMATION_JOB_NOT_FOUND, { status: 404 })
  }

  const { data: site, error: siteError } = await app
    .from("domains")
    .select("hostname, org_id")
    .eq("domain_id", job.site_id)
    .single()

  if (siteError || !site?.hostname || !site.org_id) {
    return structuredErrorResponse(ErrorCodes.SITE_NOT_FOUND, { status: 404 })
  }

  const runId = randomUUID()
  const conversationId = randomUUID()
  const tabId = randomUUID()
  const messageId = randomUUID()
  const startedAtIso = new Date().toISOString()
  const title = `[Auto] ${job.name} — ${startedAtIso}`

  const runInsert: AutomationRunInsert = {
    id: runId,
    job_id: job.id,
    started_at: startedAtIso,
    completed_at: null,
    duration_ms: null,
    status: "running",
    error: null,
    result: null,
    messages: [],
    messages_uri: null,
    triggered_by: "manual",
    changes_made: [],
    chat_conversation_id: conversationId,
    chat_tab_id: tabId,
  }

  const conversationInsert: ConversationInsert = {
    conversation_id: conversationId,
    user_id: job.user_id,
    org_id: site.org_id,
    workspace: site.hostname,
    title,
    visibility: "private",
    source: "automation_run",
    source_metadata: {
      job_id: job.id,
      claim_run_id: runId,
      triggered_by: "manual",
    },
    message_count: 1,
    last_message_at: startedAtIso,
    auto_title_set: true,
  }

  const tabInsert: ConversationTabInsert = {
    tab_id: tabId,
    conversation_id: conversationId,
    name: "Run",
    position: 0,
    message_count: 1,
    last_message_at: startedAtIso,
  }

  const messageInsert: MessageInsert = {
    message_id: messageId,
    tab_id: tabId,
    seq: 1,
    type: "sdk_message",
    content: {
      kind: "sdk_message",
      data: {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: initialMessage }],
        },
      },
    },
    status: "complete",
    version: 1,
    created_at: startedAtIso,
    updated_at: startedAtIso,
  }

  const jobUpdate: AutomationJobUpdate = {
    status: "running",
    running_at: startedAtIso,
    run_id: runId,
    claimed_by: "e2e-seed",
    lease_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  }

  const { error: conversationError } = await app.from("conversations").insert(conversationInsert)
  if (conversationError) {
    console.error("[seed-automation-transcript] Failed to insert conversation:", conversationError)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }

  const { error: tabError } = await app.from("conversation_tabs").insert(tabInsert)
  if (tabError) {
    console.error("[seed-automation-transcript] Failed to insert tab:", tabError)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }

  const [{ error: messageError }, { error: runError }, { error: jobUpdateError }] = await Promise.all([
    app.from("messages").insert(messageInsert),
    app.from("automation_runs").insert(runInsert),
    app.from("automation_jobs").update(jobUpdate).eq("id", job.id),
  ])

  if (messageError || runError || jobUpdateError) {
    console.error("[seed-automation-transcript] Failed to insert seed data:", {
      messageError,
      runError,
      jobUpdateError,
    })
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }

  const response = SeedAutomationTranscriptResponseSchema.parse({
    ok: true,
    seed: {
      jobId: job.id,
      runId,
      conversationId,
      tabId,
      title,
      initialMessage,
    },
  })

  return Response.json(response)
}

export async function DELETE(req: Request) {
  if (!isTestEndpointAuthorized(req)) {
    return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 404 })
  }

  const parsed = CleanupAutomationTranscriptRequestSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return validationError("Invalid request body for cleanup seed-automation-transcript")
  }

  const { jobId, runId, conversationId, tabId } = parsed.data
  const app = createServiceAppClient()

  const [messagesDelete, tabsDelete, conversationsDelete, runsDelete, jobsReset] = await Promise.all([
    app.from("messages").delete().eq("tab_id", tabId),
    app.from("conversation_tabs").delete().eq("tab_id", tabId),
    app.from("conversations").delete().eq("conversation_id", conversationId),
    app.from("automation_runs").delete().eq("id", runId),
    app
      .from("automation_jobs")
      .update({
        status: "idle",
        running_at: null,
        run_id: null,
        claimed_by: null,
        lease_expires_at: null,
      })
      .eq("id", jobId)
      .eq("run_id", runId),
  ])

  if (messagesDelete.error || tabsDelete.error || conversationsDelete.error || runsDelete.error || jobsReset.error) {
    console.error("[seed-automation-transcript] Cleanup failed:", {
      messagesDelete: messagesDelete.error,
      tabsDelete: tabsDelete.error,
      conversationsDelete: conversationsDelete.error,
      runsDelete: runsDelete.error,
      jobsReset: jobsReset.error,
    })
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }

  const response = CleanupAutomationTranscriptResponseSchema.parse({ ok: true })
  return Response.json(response)
}
