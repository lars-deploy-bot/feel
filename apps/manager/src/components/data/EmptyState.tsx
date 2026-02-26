interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-10 h-10 rounded-lg border border-dashed border-border flex items-center justify-center mb-4">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-text-tertiary">
          <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-[13px] font-medium text-text-primary">{title}</h3>
      {description && <p className="mt-1 text-[12px] text-text-tertiary max-w-sm text-center">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
