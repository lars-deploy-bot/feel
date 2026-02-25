import type { SelectHTMLAttributes } from "react"
import { cn } from "@/lib/cn"

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export function Select({ label, className, id, children, ...props }: SelectProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-[13px] font-medium text-text-primary mb-1.5">
          {label}
        </label>
      )}
      <select
        id={id}
        className={cn(
          "w-full px-3 py-2 text-[13px] bg-surface border border-border rounded-input text-text-primary",
          "focus:outline-none focus:ring-2 focus:ring-text-primary/10 focus:border-text-primary/30",
          "transition-all duration-100",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}
