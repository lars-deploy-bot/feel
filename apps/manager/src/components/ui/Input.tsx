import type { InputHTMLAttributes } from "react"
import { cn } from "@/lib/cn"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-[13px] font-medium text-text-primary mb-1.5">
          {label}
        </label>
      )}
      <input
        id={id}
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
        autoComplete="off"
        className={cn(
          "w-full px-3 py-2 text-[13px] bg-surface border rounded-input text-text-primary placeholder:text-text-tertiary",
          "focus:outline-none focus:ring-2 focus:ring-text-primary/10 focus:border-text-primary/30",
          "transition-all duration-100",
          error ? "border-danger" : "border-border",
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1.5 text-[12px] text-danger">{error}</p>}
    </div>
  )
}
