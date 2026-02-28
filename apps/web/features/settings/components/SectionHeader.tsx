import type { LucideIcon } from "lucide-react"
import { plural } from "../lib/format"

interface SectionHeaderProps {
  icon: LucideIcon
  iconClassName?: string
  title: string
  count: number
  unit?: string
}

export function SectionHeader({ icon: Icon, iconClassName, title, count, unit = "project" }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={14} className={iconClassName ?? "text-black/40 dark:text-white/40"} />
      <h4 className="text-sm font-medium text-black dark:text-white">{title}</h4>
      <span className="text-xs text-black/40 dark:text-white/40">
        {count} {unit}
        {plural(count)}
      </span>
    </div>
  )
}
