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
  primary: "bg-text-primary text-white hover:bg-zinc-800 active:bg-zinc-900",
  secondary: "bg-surface text-text-primary border border-border hover:bg-surface-secondary active:bg-surface-tertiary",
  danger: "bg-danger text-white hover:bg-red-600 active:bg-red-700",
  ghost: "text-text-secondary hover:bg-surface-secondary active:bg-surface-tertiary",
}

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-[13px]",
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
        "inline-flex items-center justify-center gap-2 font-medium rounded-button transition-colors duration-100 cursor-pointer",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
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
