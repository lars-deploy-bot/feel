/**
 * EmailDraftCard Component
 *
 * Displays an email draft with actions to Send, Save Draft, or Edit inline.
 * Claude can draft emails, but ONLY the user can click Send.
 *
 * Feature-flagged for superadmin only.
 */

"use client"

import { useState, useRef, useEffect, type KeyboardEvent } from "react"
import {
  Mail,
  Send,
  Save,
  Check,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  AlertTriangle,
  Settings,
  Pencil,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { EmailDraft, EmailDraftOutputProps } from "./types"

/**
 * Format relative time for display
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/**
 * Inline editable email chips
 */
function InlineEmailChips({
  label,
  emails,
  onChange,
  isEditing,
}: {
  label: string
  emails: string[]
  onChange: (emails: string[]) => void
  isEditing: boolean
}) {
  const [inputValue, setInputValue] = useState("")
  const [showInput, setShowInput] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addEmail = () => {
    const email = inputValue.trim()
    if (!email) return false

    if (!isValidEmail(email)) return false
    if (emails.includes(email)) return false

    onChange([...emails, email])
    setInputValue("")
    return true
  }

  const removeEmail = (emailToRemove: string) => {
    onChange(emails.filter(e => e !== emailToRemove))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      if (addEmail()) {
        // Keep input open for more emails
      }
    } else if (e.key === "Backspace" && !inputValue && emails.length > 0) {
      removeEmail(emails[emails.length - 1])
    } else if (e.key === "Escape") {
      setShowInput(false)
      setInputValue("")
    }
  }

  const handleBlur = () => {
    if (inputValue.trim()) {
      addEmail()
    }
    setShowInput(false)
  }

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showInput])

  if (!isEditing && (!emails || emails.length === 0)) return null

  return (
    <div className="flex items-start gap-2 text-sm group">
      <span className="text-zinc-400 dark:text-zinc-500 w-8 flex-shrink-0 pt-0.5">{label}:</span>
      <div className="flex-1 flex flex-wrap items-center gap-1">
        {emails.map(email => (
          <span
            key={email}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
              isEditing
                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                : "text-zinc-700 dark:text-zinc-300"
            }`}
          >
            {email}
            {isEditing && (
              <button
                type="button"
                onClick={() => removeEmail(email)}
                className="hover:text-blue-900 dark:hover:text-blue-100"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            {!isEditing && emails.indexOf(email) < emails.length - 1 && ","}
          </span>
        ))}
        {isEditing &&
          (showInput ? (
            <input
              ref={inputRef}
              type="email"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder="email@example.com"
              className="flex-1 min-w-[140px] bg-transparent border-none outline-none text-sm text-zinc-700 dark:text-zinc-300 placeholder-zinc-400"
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowInput(true)}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          ))}
      </div>
    </div>
  )
}

/**
 * Inline editable text field - contentEditable
 */
function InlineEditableText({
  value,
  onChange,
  isEditing,
  placeholder,
  className = "",
  multiline = false,
}: {
  value: string
  onChange: (value: string) => void
  isEditing: boolean
  placeholder?: string
  className?: string
  multiline?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Sync value to contentEditable
  useEffect(() => {
    if (ref.current && !isEditing) {
      ref.current.textContent = value
    }
  }, [value, isEditing])

  if (!isEditing) {
    return <div className={className}>{value || <span className="text-zinc-400 italic">{placeholder}</span>}</div>
  }

  // Using contentEditable div intentionally for inline editing - textarea/input don't support rich formatting
  return (
    // biome-ignore lint/a11y/useSemanticElements: contentEditable requires div for rich text editing
    <div
      ref={ref}
      role="textbox"
      tabIndex={0}
      contentEditable
      suppressContentEditableWarning
      onBlur={e => onChange(e.currentTarget.textContent || "")}
      onKeyDown={e => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      className={`${className} outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 rounded px-1 -mx-1 cursor-text`}
      data-placeholder={placeholder}
    >
      {value}
    </div>
  )
}

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: EmailDraft["status"] }) {
  const config = {
    draft: {
      bg: "bg-amber-100 dark:bg-amber-900/30",
      text: "text-amber-700 dark:text-amber-400",
      label: "Draft",
    },
    saved: {
      bg: "bg-blue-100 dark:bg-blue-900/30",
      text: "text-blue-700 dark:text-blue-400",
      label: "Saved",
    },
    sending: {
      bg: "bg-indigo-100 dark:bg-indigo-900/30",
      text: "text-indigo-700 dark:text-indigo-400",
      label: "Sending...",
    },
    sent: {
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      text: "text-emerald-700 dark:text-emerald-400",
      label: "Sent",
    },
    error: {
      bg: "bg-red-100 dark:bg-red-900/30",
      text: "text-red-700 dark:text-red-400",
      label: "Error",
    },
  }

  const { bg, text, label } = config[status]

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md ${bg} ${text}`}>
      {status === "sending" && <Loader2 className="w-3 h-3 animate-spin" />}
      {status === "sent" && <Check className="w-3 h-3" />}
      {status === "error" && <AlertCircle className="w-3 h-3" />}
      {label}
    </span>
  )
}

/**
 * Gmail not connected warning banner
 */
function GmailWarningBanner() {
  return (
    <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg">
      <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Gmail not connected</p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Connect your Gmail account to send emails.</p>
      </div>
      <a
        href="/chat?settings=integrations"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-md hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
      >
        <Settings className="w-3.5 h-3.5" />
        Settings
      </a>
    </div>
  )
}

export function EmailDraftCard({
  draft,
  onSend,
  onSaveDraft,
  onEdit,
  onDraftChange,
  actionsDisabled,
  isGmailConnected = true,
}: EmailDraftOutputProps & {
  onDraftChange?: (draft: EmailDraft) => void
  isGmailConnected?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Local editing state
  const [editedDraft, setEditedDraft] = useState<EmailDraft>(draft)

  // Sync local state with prop when not editing
  useEffect(() => {
    if (!isEditing) {
      setEditedDraft(draft)
    }
  }, [draft, isEditing])

  const handleSend = async () => {
    if (!onSend || sending) return
    setSending(true)
    try {
      await onSend(isEditing ? editedDraft : draft)
    } finally {
      setSending(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!onSaveDraft || saving) return
    setSaving(true)
    try {
      await onSaveDraft(isEditing ? editedDraft : draft)
      if (isEditing) {
        onDraftChange?.(editedDraft)
        setIsEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const startEditing = () => {
    setEditedDraft(draft)
    setIsEditing(true)
    setExpanded(true)
  }

  const finishEditing = () => {
    onDraftChange?.(editedDraft)
    onEdit?.(editedDraft)
    setIsEditing(false)
  }

  const cancelEditing = () => {
    setEditedDraft(draft)
    setIsEditing(false)
  }

  const updateField = <K extends keyof EmailDraft>(field: K, value: EmailDraft[K]) => {
    setEditedDraft(prev => ({ ...prev, [field]: value }))
  }

  const isSent = draft.status === "sent"
  const isError = draft.status === "error"
  const isSending = draft.status === "sending" || sending
  const canAct = !isSent && !isSending && !actionsDisabled

  // Border color based on status
  const borderColor = {
    draft: "border-zinc-200 dark:border-zinc-700/50",
    saved: "border-blue-200 dark:border-blue-800/30",
    sending: "border-indigo-200 dark:border-indigo-800/30",
    sent: "border-emerald-200 dark:border-emerald-800/30",
    error: "border-red-200 dark:border-red-800/30",
  }[draft.status]

  const currentDraft = isEditing ? editedDraft : draft

  return (
    <div className="space-y-3">
      {/* Gmail warning banner */}
      {!isGmailConnected && canAct && <GmailWarningBanner />}

      <div className={`rounded-xl border ${borderColor} bg-white dark:bg-zinc-900 overflow-hidden shadow-sm`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700/50">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email Draft</span>
            <StatusBadge status={draft.status} />
          </div>
          <div className="flex items-center gap-2">
            {isEditing && (
              <span className="text-xs text-blue-500 dark:text-blue-400 font-medium flex items-center gap-1">
                <Pencil className="w-3 h-3" />
                Editing
              </span>
            )}
            {draft.createdAt && !isEditing && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">{formatRelativeTime(draft.createdAt)}</span>
            )}
          </div>
        </div>

        {/* Email metadata */}
        <div className="px-4 pt-4 space-y-1.5 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <InlineEmailChips
            label="To"
            emails={currentDraft.to}
            onChange={emails => updateField("to", emails)}
            isEditing={isEditing}
          />
          <InlineEmailChips
            label="Cc"
            emails={currentDraft.cc || []}
            onChange={emails => updateField("cc", emails.length ? emails : undefined)}
            isEditing={isEditing}
          />
          <InlineEmailChips
            label="Bcc"
            emails={currentDraft.bcc || []}
            onChange={emails => updateField("bcc", emails.length ? emails : undefined)}
            isEditing={isEditing}
          />

          {/* Subject */}
          <div className="flex items-start gap-2 text-sm pt-1">
            <span className="text-zinc-400 dark:text-zinc-500 w-8 flex-shrink-0">Sub:</span>
            <InlineEditableText
              value={currentDraft.subject}
              onChange={value => updateField("subject", value)}
              isEditing={isEditing}
              placeholder="Email subject..."
              className="flex-1 text-zinc-900 dark:text-zinc-100 font-medium"
            />
          </div>
        </div>

        {/* Email body */}
        <div className="px-4 py-4">
          {isEditing ? (
            <InlineEditableText
              value={currentDraft.body}
              onChange={value => updateField("body", value)}
              isEditing={isEditing}
              placeholder="Write your email..."
              className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed min-h-[100px]"
              multiline
            />
          ) : (
            <>
              <div className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {expanded || currentDraft.body.split("\n").length <= 6
                  ? currentDraft.body
                  : `${currentDraft.body.split("\n").slice(0, 6).join("\n")}...`}
              </div>

              {/* Expand/collapse for long emails */}
              {currentDraft.body.split("\n").length > 6 && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="mt-2 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="w-3 h-3" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" />
                      Show more
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>

        {/* Error message */}
        {isError && draft.error && (
          <div className="mx-4 mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{draft.error}</p>
            </div>
          </div>
        )}

        {/* Sent confirmation */}
        {isSent && (
          <div className="mx-4 mb-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              <p className="text-sm text-emerald-700 dark:text-emerald-400">Email sent successfully</p>
            </div>
          </div>
        )}

        {/* Actions */}
        {canAct && (
          <div className="flex items-center gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-200 dark:border-zinc-700/50">
            {isEditing ? (
              <>
                <Button onClick={finishEditing} size="sm" className="gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Done
                </Button>
                <Button onClick={cancelEditing} variant="ghost" size="sm" className="gap-1.5">
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleSend}
                  disabled={isSending || !onSend || !isGmailConnected}
                  size="sm"
                  className="gap-1.5"
                  title={!isGmailConnected ? "Connect Gmail first" : undefined}
                >
                  {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Send
                </Button>

                <Button
                  onClick={handleSaveDraft}
                  disabled={saving || !onSaveDraft || !isGmailConnected}
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  title={!isGmailConnected ? "Connect Gmail first" : undefined}
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Draft
                </Button>

                <Button onClick={startEditing} variant="ghost" size="sm" className="gap-1.5 ml-auto">
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default EmailDraftCard
