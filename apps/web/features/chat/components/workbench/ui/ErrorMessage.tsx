/**
 * Consistent error display for workbench views
 */

interface ErrorMessageProps {
  message: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function ErrorMessage({ message, action }: ErrorMessageProps) {
  return (
    <div className="flex flex-col items-center justify-center h-24 gap-2">
      <span className="text-zinc-500 text-sm">{message}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
