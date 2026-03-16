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
      <Icon size={14} className={iconClassName ?? "text-[#8a8578] dark:text-[#7a756b]"} />
      <h4 className="text-sm font-medium text-[#2c2a26] dark:text-[#e8e4dc]">{title}</h4>
      <span className="text-xs text-[#b5afa3] dark:text-[#5c574d]">
        {count} {unit}
        {plural(count)}
      </span>
    </div>
  )
}
