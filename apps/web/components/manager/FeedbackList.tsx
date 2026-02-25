"use client"

import { useState } from "react"

interface FeedbackEntry {
  id: string
  workspace: string
  timestamp: string
  feedback: string
  email?: string
  conversationId?: string
  userAgent?: string
  githubIssueUrl?: string
  awareEmailSent?: string
  fixedEmailSent?: string
}

interface FeedbackListProps {
  feedback: FeedbackEntry[]
  loading: boolean
  onRefresh: () => void
}

function FeedbackActions({
  entry,
  onUpdate,
}: {
  entry: FeedbackEntry
  onUpdate: (id: string, field: string, value: string) => Promise<void>
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [value, setValue] = useState("")
  const [saving, setSaving] = useState(false)

  const startEdit = (field: string, currentValue: string) => {
    setEditing(field)
    setValue(currentValue)
  }

  const save = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await onUpdate(entry.id, editing, value)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  const fields = [
    {
      key: "githubIssueUrl",
      label: "GitHub Issue",
      value: entry.githubIssueUrl,
      placeholder: "https://github.com/eenlars/alive/issues/...",
    },
    {
      key: "awareEmailSent",
      label: "Aware email",
      value: entry.awareEmailSent,
      placeholder: "Paste the email text sent to user...",
    },
    {
      key: "fixedEmailSent",
      label: "Fixed email",
      value: entry.fixedEmailSent,
      placeholder: "Paste the email text sent to user...",
    },
  ]

  return (
    <div className="mt-3 space-y-2">
      {fields.map(field => (
        <div key={field.key} className="flex items-start gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 w-24 shrink-0 pt-1">{field.label}:</span>
          {editing === field.key ? (
            <div className="flex-1 flex gap-1.5">
              {field.key === "githubIssueUrl" ? (
                <input
                  type="text"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder={field.placeholder}
                  className="flex-1 text-xs px-2 py-1 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-[#222] text-slate-900 dark:text-white"
                />
              ) : (
                <textarea
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className="flex-1 text-xs px-2 py-1 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-[#222] text-slate-900 dark:text-white resize-y"
                />
              )}
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 self-start"
              >
                {saving ? "..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-white/20 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#333] self-start"
              >
                Cancel
              </button>
            </div>
          ) : field.value ? (
            <div className="flex-1 flex items-start gap-1.5">
              {field.key === "githubIssueUrl" ? (
                <a
                  href={field.value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all"
                >
                  {field.value}
                </a>
              ) : (
                <span className="text-xs text-green-700 dark:text-green-400 whitespace-pre-wrap break-words">
                  {field.value}
                </span>
              )}
              <button
                type="button"
                onClick={() => startEdit(field.key, field.value || "")}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
              >
                edit
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => startEdit(field.key, "")}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              + add
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export function FeedbackList({ feedback, loading, onRefresh }: FeedbackListProps) {
  const [localFeedback, setLocalFeedback] = useState<FeedbackEntry[]>(feedback)

  // Sync when parent data changes
  if (feedback !== localFeedback && !loading) {
    setLocalFeedback(feedback)
  }

  const handleUpdate = async (id: string, field: string, value: string) => {
    const res = await fetch("/api/manager/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feedbackId: id,
        [field]: value || null,
      }),
    })

    if (!res.ok) throw new Error("Failed to update")

    setLocalFeedback(prev => prev.map(entry => (entry.id === id ? { ...entry, [field]: value || undefined } : entry)))
  }

  const displayFeedback = localFeedback

  return (
    <>
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {displayFeedback.length} feedback {displayFeedback.length !== 1 ? "entries" : "entry"}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 dark:bg-[#333] dark:text-slate-300 dark:border-white/20 dark:hover:bg-[#444] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-200 dark:divide-white/10">
        {loading ? (
          <div className="text-center py-12 px-6">
            <p className="text-sm text-slate-600 dark:text-slate-400">Loading feedback...</p>
          </div>
        ) : displayFeedback.length === 0 ? (
          <div className="text-center py-12 px-6">
            <p className="text-sm text-slate-600 dark:text-slate-400">No feedback submitted yet</p>
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">Feedback from users will appear here</p>
          </div>
        ) : (
          displayFeedback.map(entry => (
            <div key={entry.id} className="px-4 sm:px-6 py-4 sm:py-5 hover:bg-slate-50/50 dark:hover:bg-[#333]/50">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="font-medium text-sm text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-none">
                    {entry.workspace}
                  </span>
                  {entry.email && <span className="text-xs text-slate-500 dark:text-slate-400">{entry.email}</span>}
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(entry.timestamp).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {entry.fixedEmailSent && (
                    <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                      Fixed
                    </span>
                  )}
                  {entry.awareEmailSent && !entry.fixedEmailSent && (
                    <span className="text-xs px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">
                      Aware
                    </span>
                  )}
                  {entry.githubIssueUrl && (
                    <a
                      href={entry.githubIssueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded hover:underline"
                    >
                      Issue
                    </a>
                  )}
                  {entry.conversationId && (
                    <span className="text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 rounded">
                      Has conversation
                    </span>
                  )}
                </div>
              </div>

              <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap mb-3 break-words">
                {entry.feedback}
              </div>

              <FeedbackActions entry={entry} onUpdate={handleUpdate} />

              {entry.userAgent && (
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate mt-3">
                  {entry.userAgent}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  )
}
