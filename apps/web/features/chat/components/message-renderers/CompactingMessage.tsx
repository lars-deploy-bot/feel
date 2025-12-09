export function CompactingMessage() {
  return (
    <div className="py-3 mb-4 flex items-center justify-center">
      <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <div className="text-sm text-amber-800 dark:text-amber-200 font-medium">Compacting context...</div>
        </div>
      </div>
    </div>
  )
}
