import { cn } from "@/lib/cn"

type BadgeVariant = "default" | "success" | "warning" | "danger" | "accent"

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-surface-tertiary text-text-secondary",
  success: "bg-success-subtle text-emerald-700",
  warning: "bg-warning-subtle text-amber-700",
  danger: "bg-danger-subtle text-red-700",
  accent: "bg-accent-subtle text-indigo-700",
}

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-badge",
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
