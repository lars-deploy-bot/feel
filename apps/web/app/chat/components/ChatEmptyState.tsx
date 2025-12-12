"use client"

interface ChatEmptyStateProps {
  workspace: string | null
  totalDomainCount: number
  isLoading?: boolean
  onTemplatesClick: () => void
}

export function ChatEmptyState({ workspace, totalDomainCount, isLoading, onTemplatesClick }: ChatEmptyStateProps) {
  // Show nothing while loading organizations - prevents flash of "no sites" message
  if (isLoading && !workspace) {
    return null
  }

  return (
    <div className="flex items-start justify-center h-full pt-32">
      <div className="max-w-md text-center space-y-6">
        {workspace ? (
          <>
            <p className="text-lg text-black/90 dark:text-white/90 font-medium">What's next?</p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onTemplatesClick}
                className="px-4 py-2 rounded-md bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-sm font-medium text-black dark:text-white transition-colors"
              >
                Browse templates
              </button>
            </div>
          </>
        ) : totalDomainCount === 0 ? (
          <>
            <p className="text-lg text-black/90 dark:text-white/90 font-medium">
              Welcome! You don't have any sites yet.
            </p>
            <div className="pt-2">
              <a
                href="/deploy"
                className="inline-block px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                Deploy your first site
              </a>
            </div>
          </>
        ) : (
          <p className="text-lg text-black/60 dark:text-white/60 font-medium">Select a site above to start chatting</p>
        )}
      </div>
    </div>
  )
}
