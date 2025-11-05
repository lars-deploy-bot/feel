import type { ReactNode } from "react"
import { getToolIcon } from "@/lib/tool-icons"

interface ToolButtonProps {
  onClick: () => void
  children: ReactNode
  variant?: "default" | "error"
}

export function ToolButton({ onClick, children, variant = "default" }: ToolButtonProps) {
  const toolName = typeof children === "string" ? children : ""
  const Icon = getToolIcon(toolName)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-normal hover:text-black/50 transition-colors flex items-center gap-1.5 ${
        variant === "error" ? "text-red-600" : "text-black/35"
      }`}
    >
      <Icon size={12} className="opacity-60" />
      <span>{children}</span>
    </button>
  )
}
