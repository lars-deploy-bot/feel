"use client"

import { MessageCircle } from "lucide-react"
import { useId, useState } from "react"
import { useAuth } from "@/features/deployment/hooks/useAuth"

interface FeedbackModalProps {
  onClose: () => void
  workspace?: string
  conversationId?: string
}

export function FeedbackModal({ onClose, workspace, conversationId }: FeedbackModalProps) {
  const titleId = useId()
  const textareaId = useId()
  const { user } = useAuth()
  const [feedback, setFeedback] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          feedback,
          email: user?.email,
          workspace,
          conversationId,
          userAgent: navigator.userAgent,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to submit feedback" }))
        throw new Error(errorData.message || "Failed to submit feedback")
      }

      setSuccess(true)
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err) {
      console.error("Feedback submission error:", err)
      setError(err instanceof Error ? err.message : "Failed to submit feedback")
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="bg-white dark:bg-[#1a1a1a] rounded-lg p-8 max-w-md w-full shadow-xl animate-in fade-in-0 zoom-in-95 duration-200"
          onClick={e => e.stopPropagation()}
          role="document"
        >
          <div className="w-16 h-16 bg-green-50 dark:bg-green-950 rounded-full flex items-center justify-center mx-auto mb-6">
            <MessageCircle className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-xl font-medium text-black dark:text-white mb-2 text-center">Thank you!</h3>
          <p className="text-sm text-black/60 dark:text-white/60 text-center">Your feedback has been received</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="bg-white dark:bg-[#1a1a1a] rounded-lg p-8 max-w-md w-full shadow-xl animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
        role="document"
      >
        <div className="w-16 h-16 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
          <MessageCircle className="w-8 h-8 text-black dark:text-white" />
        </div>
        <h3 id={titleId} className="text-xl font-medium text-black dark:text-white mb-6 text-center">
          Send Feedback
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor={textareaId} className="block text-xs text-black/60 dark:text-white/60 mb-2 font-normal">
              Tell us what you think
            </label>
            <textarea
              id={textareaId}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Your feedback..."
              rows={5}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#2a2a2a] border border-black/20 dark:border-white/20 rounded text-sm text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-colors resize-none"
              required
              disabled={loading}
              autoComplete="off"
              data-1p-ignore
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded p-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-black dark:text-white rounded transition-all font-medium"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-black dark:bg-white text-white dark:text-black hover:bg-black/80 dark:hover:bg-white/80 rounded transition-all font-medium disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
