import { ReactNode } from "react"

interface ToolButtonProps {
  onClick: () => void
  isExpanded?: boolean
  hasContent?: boolean
  children: ReactNode
  variant?: "default" | "error"
}

export function ToolButton({
  onClick,
  isExpanded = false,
  hasContent = true,
  children,
  variant = "default",
}: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-thin hover:text-black/60 transition-colors ${
        variant === "error" ? "text-red-600" : "text-black/40"
      }`}
    >
      {children}
      {hasContent && <span className="ml-1">{isExpanded ? "−" : "+"}</span>}
    </button>
  )
}
