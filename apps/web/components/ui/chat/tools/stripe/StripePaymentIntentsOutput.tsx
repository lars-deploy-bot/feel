interface StripePaymentIntentsOutputProps {
  paymentIntents: any[]
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100)
}

export function StripePaymentIntentsOutput({ paymentIntents }: StripePaymentIntentsOutputProps) {
  if (!paymentIntents || paymentIntents.length === 0) {
    return <div className="text-[13px] text-black/50 dark:text-white/50 py-2">No payment intents found</div>
  }

  // Calculate summary stats
  const succeeded = paymentIntents.filter(pi => pi.status === "succeeded")
  const failed = paymentIntents.filter(
    pi => pi.status === "requires_payment_method" || pi.status === "failed" || pi.status === "canceled",
  )
  const processing = paymentIntents.filter(
    pi => pi.status === "processing" || pi.status === "requires_confirmation" || pi.status === "requires_action",
  )

  const totalSucceeded = succeeded.reduce((sum, pi) => sum + (pi.amount || 0), 0)
  const currency = paymentIntents[0]?.currency || "eur"

  return (
    <div className="space-y-3">
      {/* Summary Stats */}
      <div className="flex gap-10 pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-black/90 dark:text-white/90">
            {succeeded.length}
          </p>
          <p className="text-[12px] text-black/40 dark:text-white/40 mt-1">
            Succeeded ({formatAmount(totalSucceeded, currency)})
          </p>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-black/90 dark:text-white/90">
            {failed.length}
          </p>
          <p className="text-[12px] text-black/40 dark:text-white/40 mt-1">Failed</p>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-black/90 dark:text-white/90">
            {processing.length}
          </p>
          <p className="text-[12px] text-black/40 dark:text-white/40 mt-1">Processing</p>
        </div>
      </div>

      {/* Payment Intents Table */}
      <div className="border border-black/[0.06] dark:border-white/[0.08] rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-black/[0.02] dark:bg-white/[0.02] sticky top-0 z-10">
            <tr className="border-b border-black/[0.06] dark:border-white/[0.08]">
              <th className="text-left px-3 py-2 font-medium text-black/50 dark:text-white/50">Payment</th>
              <th className="text-left px-3 py-2 font-medium text-black/50 dark:text-white/50">Customer</th>
              <th className="text-right px-3 py-2 font-medium text-black/50 dark:text-white/50">Amount</th>
              <th className="text-left px-3 py-2 font-medium text-black/50 dark:text-white/50">Status</th>
            </tr>
          </thead>
          <tbody>
            {paymentIntents.map((pi, index) => {
              const isSuccess = pi.status === "succeeded"
              const isFailed =
                pi.status === "requires_payment_method" || pi.status === "failed" || pi.status === "canceled"

              return (
                <tr
                  key={pi.id || `pi-${index}`}
                  className="border-b border-black/[0.04] dark:border-white/[0.04] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors duration-100"
                >
                  <td className="px-3 py-2">
                    <div className="font-mono text-[10px] text-black/40 dark:text-white/40">
                      <a
                        href={`https://dashboard.stripe.com/payments/${pi.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-500 dark:hover:text-blue-400"
                      >
                        {pi.id}
                      </a>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {pi.customer ? (
                      <a
                        href={`https://dashboard.stripe.com/customers/${pi.customer}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-black/60 dark:text-white/60 hover:text-blue-500 dark:hover:text-blue-400"
                      >
                        {pi.customer}
                      </a>
                    ) : (
                      <span className="text-black/30 dark:text-white/30">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="font-semibold text-black/80 dark:text-white/80">
                      {formatAmount(pi.amount || 0, pi.currency || currency)}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-medium ${
                        isSuccess
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                          : isFailed
                            ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                            : "bg-black/[0.04] text-black/60 dark:bg-white/[0.06] dark:text-white/60"
                      }`}
                    >
                      {pi.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
