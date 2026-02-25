import { cn } from "@/lib/cn"

interface StatCardProps {
  label: string
  value: string | number
  subtitle?: string
  className?: string
}

export function StatCard({ label, value, subtitle, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-surface rounded-card border border-border p-5",
        "shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-text-primary tabular-nums">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-text-tertiary">{subtitle}</p>}
    </div>
  )
}
