interface StatCardProps {
  label: string
  value: string | number
}

export function StatCard({ label, value }: StatCardProps) {
  return (
    <div>
      <p className="text-2xl font-semibold text-text-primary tabular-nums tracking-tight">{value}</p>
      <p className="text-[12px] text-text-tertiary mt-1">{label}</p>
    </div>
  )
}
