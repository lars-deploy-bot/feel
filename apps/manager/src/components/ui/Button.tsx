import type { ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/cn"
import { Spinner } from "./Spinner"

type Variant = "primary" | "secondary" | "danger" | "ghost"
type Size = "sm" | "md"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-accent text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] hover:bg-accent-hover active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]",
  secondary:
    "bg-white text-text-primary border border-border shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)] hover:bg-surface-secondary active:bg-surface-tertiary",
  danger:
    "bg-danger text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] hover:bg-red-600 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]",
  ghost: "text-text-secondary hover:bg-surface-tertiary active:bg-border",
}

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
}

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium rounded-button transition-all duration-150 cursor-pointer",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  )
}
