"use client"

interface FeedbackEntry {
  id: string
  workspace: string
  timestamp: string
  feedback: string
  conversationId?: string
  userAgent?: string
}

interface FeedbackListProps {
  feedback: FeedbackEntry[]
  loading: boolean
  onRefresh: () => void
}

export function FeedbackList({ feedback, loading, onRefresh }: FeedbackListProps) {
  return (
    <>
      <div className="px-6 py-5 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">
            {feedback.length} feedback {feedback.length !== 1 ? "entries" : "entry"}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="text-xs px-2.5 py-1.5 text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        {loading ? (
          <div className="text-center py-12 px-6">
            <p className="text-sm text-slate-600">Loading feedback...</p>
          </div>
        ) : feedback.length === 0 ? (
          <div className="text-center py-12 px-6">
            <p className="text-sm text-slate-600">No feedback submitted yet</p>
            <p className="text-sm text-slate-500 mt-1">Feedback from users will appear here</p>
          </div>
        ) : (
          feedback.map(entry => (
            <div key={entry.id} className="px-6 py-5 hover:bg-slate-50">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-slate-900">{entry.workspace}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(entry.timestamp).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {entry.conversationId && (
                  <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded">Has conversation</span>
                )}
              </div>

              <div className="text-sm text-slate-700 whitespace-pre-wrap mb-3">{entry.feedback}</div>

              {entry.userAgent && <div className="text-xs text-slate-500 font-mono truncate">{entry.userAgent}</div>}
            </div>
          ))
        )}
      </div>
    </>
  )
}
