interface ContentAreaProps {
  children: React.ReactNode
}

export function ContentArea({ children }: ContentAreaProps) {
  return (
    <main className="flex-1 overflow-y-auto bg-surface-secondary">
      <div className="max-w-6xl mx-auto px-6 py-6">{children}</div>
    </main>
  )
}
