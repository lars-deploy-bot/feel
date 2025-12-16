/**
 * Consistent loading spinner for sandbox views
 */
export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-24">
      <div className="w-4 h-4 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin" />
    </div>
  )
}
