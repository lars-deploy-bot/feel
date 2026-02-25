interface StripeBalanceOutputProps {
  balance: any
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100)
}

export function StripeBalanceOutput({ balance }: StripeBalanceOutputProps) {
  if (!balance) {
    return <div className="text-[13px] text-black/50 dark:text-white/50 py-2">No balance data</div>
  }

  const available = balance.available?.[0]
  const instantAvailable = balance.instant_available?.[0]
  const pending = balance.pending?.[0]

  const currency = available?.currency || instantAvailable?.currency || pending?.currency || "eur"

  return (
    <div className="flex gap-10 pb-3">
      <div>
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-black/90 dark:text-white/90">
          {available ? formatAmount(available.amount, currency) : "—"}
        </p>
        <p className="text-[12px] text-black/40 dark:text-white/40 mt-1">Available</p>
      </div>

      {instantAvailable && (
        <div>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-black/90 dark:text-white/90">
            {formatAmount(instantAvailable.amount, currency)}
          </p>
          <p className="text-[12px] text-black/40 dark:text-white/40 mt-1">Instant</p>
        </div>
      )}

      {pending && (
        <div>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-black/90 dark:text-white/90">
            {formatAmount(pending.amount, currency)}
          </p>
          <p className="text-[12px] text-black/40 dark:text-white/40 mt-1">Pending</p>
        </div>
      )}
    </div>
  )
}
