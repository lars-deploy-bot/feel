import { cn } from "@/lib/cn"

interface CostBarProps {
  cost: number
  maxCost: number
}

export function CostBar({ cost, maxCost }: CostBarProps) {
  const pct = maxCost > 0 ? Math.min((cost / maxCost) * 100, 100) : 0

  const barColor = pct > 75 ? "bg-red-500" : pct > 40 ? "bg-amber-500" : "bg-emerald-500"

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="flex-1 h-2 rounded-full bg-surface-secondary overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", barColor)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] font-medium text-text-primary tabular-nums whitespace-nowrap">
        ${cost.toFixed(2)}
      </span>
    </div>
  )
}
