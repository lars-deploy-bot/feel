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
        "h-9 px-2 flex items-center border-b border-black/[0.08] dark:border-white/[0.04] bg-zinc-100/50 dark:bg-zinc-900/30 shrink-0",
        className,
      )}
    >
      {children}
    </div>
  )
}
