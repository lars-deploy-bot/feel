/**
 * EmailDraftOutput - Tool result renderer for email drafts
 *
 * Renders email drafts created by Claude with Send/Save actions.
 * CRITICAL: Claude can draft emails, but ONLY the user can click Send.
 *
 * Feature-flagged for superadmin only (uses fake data for testing).
 */

"use client"

import { useState } from "react"
import type { ToolResultRendererProps } from "@/lib/tools/tool-registry"
import { EmailDraftCard } from "@/components/email/EmailDraftCard"
import type { EmailDraft } from "@/components/email/types"
import { FAKE_EMAIL_DRAFTS } from "@/components/email/types"

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

  return {
    id: (obj.id as string) || undefined,
    to: toArray.map(String),
    cc: Array.isArray(obj.cc) ? obj.cc.map(String) : undefined,
    bcc: Array.isArray(obj.bcc) ? obj.bcc.map(String) : undefined,
    subject: String(obj.subject || ""),
    body: String(obj.body || obj.content || obj.message || ""),
    threadId: (obj.threadId as string) || (obj.thread_id as string) || undefined,
    status: "draft",
    createdAt: new Date().toISOString(),
  }
}

/**
 * Email Draft Output Renderer
 *
 * For tool results like:
 * - gmail__compose_email
 * - gmail__create_draft
 * - email__draft
 */
export function EmailDraftOutput({ data }: ToolResultRendererProps<unknown>) {
  const [draft, setDraft] = useState<EmailDraft | null>(() => parseEmailDraft(data))

  // Handle send action (will call Gmail API in the future)
  const handleSend = async (emailDraft: EmailDraft) => {
    setDraft({ ...emailDraft, status: "sending" })

    // TODO: Call Gmail API to send email
    // For now, simulate with fake success after 1.5s
    await new Promise(resolve => setTimeout(resolve, 1500))

    setDraft({ ...emailDraft, status: "sent" })
  }

  // Handle save draft action
  const handleSaveDraft = async (emailDraft: EmailDraft) => {
    // TODO: Call Gmail API to save draft
    // For now, simulate with fake success
    await new Promise(resolve => setTimeout(resolve, 800))

    setDraft({ ...emailDraft, status: "saved", id: `draft-${Date.now()}` })
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

  // Must have recipients
  const hasRecipients = obj.to || obj.recipients
  // Must have content
  const hasContent = obj.subject || obj.body || obj.content

  return Boolean(hasRecipients && hasContent)
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
