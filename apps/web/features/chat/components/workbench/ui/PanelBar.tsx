import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PanelBarProps {
  children: ReactNode
  className?: string
}

export function PanelBar({ children, className }: PanelBarProps) {
  return (
    <div
      className={cn(
        "h-9 px-2.5 flex items-center border-b border-black/[0.06] dark:border-white/[0.04] bg-black/[0.015] dark:bg-white/[0.02] shrink-0",
        className,
      )}
    >
      {children}
    </div>
  )
}
