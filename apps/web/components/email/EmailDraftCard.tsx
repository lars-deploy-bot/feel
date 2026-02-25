/**
 * EmailDraftCard Component
 *
 * Clean email compose UI. Claude drafts, user sends.
 */

"use client"

import { AlertCircle, AlertTriangle, Check, Loader2, Send, X } from "lucide-react"
import { type KeyboardEvent, useEffect, useRef, useState } from "react"
import type { EmailDraft, EmailDraftOutputProps } from "./types"

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function EmailField({
  label,
  emails,
  onChange,
  placeholder = "Add recipient...",
}: {
  label: string
  emails: string[]
  onChange: (emails: string[]) => void
  placeholder?: string
}) {
  const [inputValue, setInputValue] = useState("")

  const addEmail = () => {
    const email = inputValue.trim()
    if (!email || !isValidEmail(email) || emails.includes(email)) return false
    onChange([...emails, email])
    setInputValue("")
    return true
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addEmail()
    } else if (e.key === "Backspace" && !inputValue && emails.length > 0) {
      onChange(emails.slice(0, -1))
    }
  }

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-black/[0.06] dark:border-white/[0.08]">
      <span className="text-[11px] text-black/40 dark:text-white/40 w-6">{label}</span>
      <div className="flex-1 flex flex-wrap items-center gap-1.5">
        {emails.map(email => (
          <span
            key={email}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-black/[0.04] dark:bg-white/[0.06] text-black/60 dark:text-white/60 rounded-[6px]"
          >
            {email}
            <button
              type="button"
              onClick={() => onChange(emails.filter(e => e !== email))}
              className="hover:text-black/80 dark:hover:text-white/80 transition-colors duration-100"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="email"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addEmail()}
          placeholder={emails.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent text-[13px] text-black/70 dark:text-white/70 placeholder-black/30 dark:placeholder-white/30 outline-none"
        />
      </div>
    </div>
  )
}

export function EmailDraftCard({
  draft,
  onSend,
  onSaveDraft,
  onEdit: _onEdit,
  onDraftChange,
  actionsDisabled,
  isGmailConnected = true,
}: EmailDraftOutputProps & {
  onDraftChange?: (draft: EmailDraft) => void
  isGmailConnected?: boolean
}) {
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editedDraft, setEditedDraft] = useState<EmailDraft>(draft)
  const [showCcBcc, setShowCcBcc] = useState(
    Boolean((draft.cc && draft.cc.length > 0) || (draft.bcc && draft.bcc.length > 0)),
  )
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.style.height = "auto"
      bodyRef.current.style.height = `${Math.max(120, bodyRef.current.scrollHeight)}px`
    }
  }, [editedDraft.body])

  const handleSend = async () => {
    if (!onSend || sending) return
    setSending(true)
    try {
      await onSend(editedDraft)
    } finally {
      setSending(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!onSaveDraft || saving) return
    setSaving(true)
    try {
      await onSaveDraft(editedDraft)
      onDraftChange?.(editedDraft)
    } finally {
      setSaving(false)
    }
  }

  const updateField = <K extends keyof EmailDraft>(field: K, value: EmailDraft[K]) => {
    setEditedDraft(prev => ({ ...prev, [field]: value }))
  }

  const isSent = draft.status === "sent"
  const isError = draft.status === "error"
  const isSending = draft.status === "sending" || sending
  const canAct = !isSent && !isSending && !actionsDisabled

  // Sent state - minimal
  if (isSent) {
    return (
      <div className="flex items-center gap-2 py-2 text-[13px] text-black/60 dark:text-white/60">
        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <span>Email sent to {editedDraft.to.join(", ")}</span>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.08] overflow-hidden">
      {/* Gmail warning */}
      {!isGmailConnected && canAct && (
        <div className="px-3 pt-3">
          <div className="flex items-center gap-2 text-[12px] text-black/50 dark:text-white/50">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Gmail not connected.</span>
            <a
              href="/chat?settings=integrations"
              className="text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 underline"
            >
              Connect
            </a>
          </div>
        </div>
      )}

      {/* Recipients */}
      <div className="px-3 pt-2">
        <EmailField label="To" emails={editedDraft.to} onChange={emails => updateField("to", emails)} />

        {showCcBcc ? (
          <>
            <EmailField
              label="Cc"
              emails={editedDraft.cc || []}
              onChange={emails => updateField("cc", emails.length ? emails : undefined)}
              placeholder=""
            />
            <EmailField
              label="Bcc"
              emails={editedDraft.bcc || []}
              onChange={emails => updateField("bcc", emails.length ? emails : undefined)}
              placeholder=""
            />
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowCcBcc(true)}
            className="text-[11px] text-black/30 dark:text-white/30 hover:text-black/50 dark:hover:text-white/50 py-1 transition-colors duration-100"
          >
            + Cc/Bcc
          </button>
        )}
      </div>

      {/* Subject */}
      <div className="px-3 py-2 border-b border-black/[0.06] dark:border-white/[0.08]">
        <input
          type="text"
          value={editedDraft.subject}
          onChange={e => updateField("subject", e.target.value)}
          placeholder="Subject"
          className="w-full text-[13px] font-medium text-black/80 dark:text-white/80 bg-transparent outline-none placeholder-black/30 dark:placeholder-white/30"
        />
      </div>

      {/* Body */}
      <div className="px-3 py-3">
        <textarea
          ref={bodyRef}
          value={editedDraft.body}
          onChange={e => updateField("body", e.target.value)}
          placeholder="Write your message..."
          className="w-full text-[13px] text-black/60 dark:text-white/60 bg-transparent outline-none resize-none placeholder-black/30 dark:placeholder-white/30 leading-relaxed"
          style={{ minHeight: "120px" }}
        />
      </div>

      {/* Error */}
      {isError && draft.error && (
        <div className="mx-3 mb-3 flex items-start gap-2 text-[12px] text-red-600 dark:text-red-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{draft.error}</span>
        </div>
      )}

      {/* Actions */}
      {canAct && (
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-black/[0.06] dark:border-white/[0.08]">
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || !onSend || !isGmailConnected || editedDraft.to.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-40 transition-colors duration-100"
          >
            {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving || !onSaveDraft || !isGmailConnected}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-black/[0.06] dark:border-white/[0.08] text-black/60 dark:text-white/60 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] disabled:opacity-40 transition-colors duration-100"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Save Draft
          </button>
        </div>
      )}
    </div>
  )
}
