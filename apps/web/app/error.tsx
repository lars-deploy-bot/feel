"use client"

import { useEffect } from "react"

// biome-ignore lint/suspicious/noShadowRestrictedNames: Next.js error boundary requires Error type
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Root error boundary caught:", error)
    // TODO: Send to error tracking service (Sentry)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white border border-red-200 rounded-lg p-6 shadow-lg">
        <div className="flex items-start gap-3">
          <svg
            className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>

          <div className="flex-1">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Something went wrong</h2>

            <p className="text-sm text-red-700 mb-4">
              The application encountered an unexpected error. Your conversation data has been preserved.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors"
              >
                Try again
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.href = "/chat"
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded hover:bg-gray-300 transition-colors"
              >
                Return to chat
              </button>
            </div>

            {process.env.NODE_ENV === "development" && (
              <details className="mt-4">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                  Error details (development only)
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                  {error.message}
                  {"\n\n"}
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
