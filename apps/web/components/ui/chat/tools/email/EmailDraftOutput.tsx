/**
 * EmailDraftOutput - Tool result renderer for email drafts
 *
 * Renders email drafts created by Claude with Send/Save actions.
 * CRITICAL: Claude can draft emails, but ONLY the user can click Send.
 *
 * Provider-aware: routes to /api/gmail/* or /api/outlook/* based on toolName.
 */

"use client"

import { useCallback, useState } from "react"
import { EmailDraftCard } from "@/components/email/EmailDraftCard"
import type { EmailDraft } from "@/components/email/types"
import { FAKE_EMAIL_DRAFTS } from "@/components/email/types"
import { ApiError, postty } from "@/lib/api/api-client"
import { validateRequest } from "@/lib/api/schemas"
import { useDexieMessageActions } from "@/lib/db/dexieMessageStore"
import type { ToolResultRendererProps } from "@/lib/tools/tool-registry"
import { patchEmailDraftToolResultContent, toPersistedEmailDraftStatus } from "./emailDraftState"

/**
 * Derive email endpoint prefix from toolName.
 * Outlook tools → "outlook", everything else → "gmail".
 */
function getEmailProvider(toolName: string): "outlook" | "gmail" {
  if (toolName.toLowerCase().includes("outlook")) return "outlook"
  return "gmail"
}

/**
 * Parse email draft from tool output
 * Handles various formats Claude might return
 */
function parseEmailDraft(data: unknown): EmailDraft | null {
  if (!data || typeof data !== "object") return null

  const obj = data as Record<string, unknown>

  // Must have at least 'to' and 'subject' or 'body'
  if (!obj.to && !obj.recipients) return null
  if (!obj.subject && !obj.body) return null

  const toField = obj.to || obj.recipients
  const toArray = Array.isArray(toField) ? toField : typeof toField === "string" ? [toField] : []
  const subject = String(obj.subject || "")

  return {
    id: (obj.id as string) || undefined,
    to: toArray.map(String),
    cc: Array.isArray(obj.cc) ? obj.cc.map(String) : undefined,
    bcc: Array.isArray(obj.bcc) ? obj.bcc.map(String) : undefined,
    subject,
    body: String(obj.body || obj.content || obj.message || ""),
    threadId: (obj.threadId as string) || (obj.thread_id as string) || undefined,
    status: toPersistedEmailDraftStatus(obj.status),
    createdAt: new Date().toISOString(),
  }
}

/**
 * Email Draft Output Renderer
 *
 * For tool results like:
 * - mcp__gmail__compose_email
 * - mcp__gmail__create_draft
 */
export function EmailDraftOutput({ data, tabId, toolUseId, toolName }: ToolResultRendererProps<unknown>) {
  const [draft, setDraft] = useState<EmailDraft | null>(() => parseEmailDraft(data))
  const [error, setError] = useState<string | null>(null)
  const { updateToolResultContentByToolUseId } = useDexieMessageActions()
  const provider = getEmailProvider(toolName)

  const persistDraftState = useCallback(
    async (nextDraft: EmailDraft) => {
      if (!tabId || !toolUseId) return

      await updateToolResultContentByToolUseId(tabId, toolUseId, content =>
        patchEmailDraftToolResultContent(content, {
          status: toPersistedEmailDraftStatus(nextDraft.status),
          id: nextDraft.id,
          threadId: nextDraft.threadId,
        }),
      )
    },
    [tabId, toolUseId, updateToolResultContentByToolUseId],
  )

  // Handle send action - calls /api/{provider}/send
  const handleSend = async (emailDraft: EmailDraft) => {
    setDraft({ ...emailDraft, status: "sending" })
    setError(null)

    try {
      const sendPayload = {
        to: emailDraft.to,
        cc: emailDraft.cc,
        bcc: emailDraft.bcc,
        subject: emailDraft.subject,
        body: emailDraft.body,
        threadId: emailDraft.threadId,
      }

      // Use provider-specific endpoint for type-safe request/response
      const result =
        provider === "outlook"
          ? await postty("outlook/send", validateRequest("outlook/send", sendPayload))
          : await postty("gmail/send", validateRequest("gmail/send", sendPayload))

      const nextDraft = {
        ...emailDraft,
        status: "sent",
        id: result.messageId,
        threadId: result.threadId || emailDraft.threadId,
      } satisfies EmailDraft

      setDraft(nextDraft)
      await persistDraftState(nextDraft)
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to send email"
      setError(message)
      setDraft({ ...emailDraft, status: "draft" })
    }
  }

  // Handle save draft action - calls /api/{provider}/draft
  const handleSaveDraft = async (emailDraft: EmailDraft) => {
    setDraft({ ...emailDraft, status: "saving" })
    setError(null)

    try {
      const draftPayload = {
        to: emailDraft.to,
        cc: emailDraft.cc,
        subject: emailDraft.subject,
        body: emailDraft.body,
        threadId: emailDraft.threadId,
      }

      // Use provider-specific endpoint for type-safe request/response
      const result =
        provider === "outlook"
          ? await postty("outlook/draft", validateRequest("outlook/draft", draftPayload))
          : await postty("gmail/draft", validateRequest("gmail/draft", draftPayload))

      const nextDraft = {
        ...emailDraft,
        status: "saved",
        id: result.draftId,
      } satisfies EmailDraft

      setDraft(nextDraft)
      await persistDraftState(nextDraft)
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to save draft"
      setError(message)
      setDraft({ ...emailDraft, status: "draft" })
    }
  }

  // Handle edit action (could open a modal in the future)
  const handleEdit = (emailDraft: EmailDraft) => {
    // TODO: Open edit modal or inline editing
    console.log("[EmailDraftOutput] Edit requested:", emailDraft)
  }

  if (!draft) {
    return (
      <div className="mt-2 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-900/50 text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Could not parse email draft</p>
      </div>
    )
  }

  return (
    <div className="mt-2">
      {error && (
        <div className="mb-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      <EmailDraftCard draft={draft} onSend={handleSend} onSaveDraft={handleSaveDraft} onEdit={handleEdit} />
    </div>
  )
}

/**
 * Validate if data looks like an email draft
 */
export function validateEmailDraft(data: unknown): boolean {
  if (!data || typeof data !== "object") return false
  const obj = data as Record<string, unknown>

  // Must have recipients (check existence, not truthiness - empty array is invalid)
  const hasRecipients = Array.isArray(obj.to) ? obj.to.length > 0 : !!(obj.to || obj.recipients)

  // Must have subject OR body defined (can be empty strings - user can fill in)
  const hasSubjectOrBody = "subject" in obj || "body" in obj || "content" in obj

  return hasRecipients && hasSubjectOrBody
}

/**
 * Demo component for testing - shows fake email drafts
 * Only visible to superadmins
 */
export function EmailDraftDemo() {
  return (
    <div className="space-y-4 p-4">
      <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
        Email Draft Preview (Superadmin Only)
      </h3>
      {FAKE_EMAIL_DRAFTS.map(draft => (
        <EmailDraftCard
          key={draft.id}
          draft={draft}
          onSend={async d => {
            console.log("[Demo] Send:", d)
            await new Promise(r => setTimeout(r, 1500))
          }}
          onSaveDraft={async d => {
            console.log("[Demo] Save:", d)
            await new Promise(r => setTimeout(r, 800))
          }}
          onEdit={d => console.log("[Demo] Edit:", d)}
        />
      ))}
    </div>
  )
}
