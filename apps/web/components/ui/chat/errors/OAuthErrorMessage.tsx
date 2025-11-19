"use client"

import { AlertCircle, RefreshCw } from "lucide-react"

interface OAuthErrorMessageProps {
  errorText: string
}

export function OAuthErrorMessage(_props: OAuthErrorMessageProps) {
  const handleReauthenticate = () => {
    // Reload the page to trigger auth flow
    window.location.reload()
  }

  return (
    <div className="my-6 max-w-2xl">
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-2">Authentication Expired</h3>
            <p className="text-sm text-amber-800 dark:text-amber-200 mb-4">
              Your OAuth token has expired. Please re-authenticate to continue using Claude.
            </p>
            <button
              type="button"
              onClick={handleReauthenticate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-white text-sm font-medium rounded-md transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Re-authenticate
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
