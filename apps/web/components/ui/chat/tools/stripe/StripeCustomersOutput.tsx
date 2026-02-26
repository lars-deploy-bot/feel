interface StripeCustomersOutputProps {
  customers: any[]
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatBalance(balance: number, currency: string = "eur"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(balance / 100)
}

export function StripeCustomersOutput({ customers }: StripeCustomersOutputProps) {
  if (!Array.isArray(customers) || customers.length === 0) {
    return <div className="text-[13px] text-black/50 dark:text-white/50 py-2">No customers found</div>
  }

  return (
    <div className="border border-black/[0.06] dark:border-white/[0.08] rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="bg-black/[0.02] dark:bg-white/[0.02] sticky top-0 z-10">
          <tr className="border-b border-black/[0.06] dark:border-white/[0.08]">
            <th className="text-left px-3 py-2 font-medium text-black/50 dark:text-white/50">Customer</th>
            <th className="text-left px-3 py-2 font-medium text-black/50 dark:text-white/50">Email</th>
            <th className="text-left px-3 py-2 font-medium text-black/50 dark:text-white/50 whitespace-nowrap">
              Created
            </th>
            <th className="text-right px-3 py-2 font-medium text-black/50 dark:text-white/50">Balance</th>
            <th className="text-center px-3 py-2 font-medium text-black/50 dark:text-white/50">Status</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer, index) => {
            const currency = customer?.currency || "eur"
            const balance = customer?.balance || 0

            return (
              <tr
                key={customer?.id || `customer-${index}`}
                className="border-b border-black/[0.04] dark:border-white/[0.04] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors duration-100"
              >
                <td className="px-3 py-2">
                  <div className="text-black/70 dark:text-white/70 font-medium">{customer?.name || "Unnamed"}</div>
                  {customer?.id && (
                    <div className="font-mono text-[10px] text-black/40 dark:text-white/40">
                      <a
                        href={`https://dashboard.stripe.com/customers/${customer.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-500 dark:hover:text-blue-400"
                      >
                        {customer.id}
                      </a>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-black/60 dark:text-white/60">
                  {customer?.email || <span className="text-black/30 dark:text-white/30">—</span>}
                </td>
                <td className="px-3 py-2 text-black/50 dark:text-white/50 whitespace-nowrap">
                  {customer?.created ? formatDate(customer.created) : "—"}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {balance !== 0 ? (
                    <span
                      className={
                        balance < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                      }
                    >
                      {formatBalance(balance, currency)}
                    </span>
                  ) : (
                    <span className="text-black/30 dark:text-white/30">{formatBalance(0, currency)}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {customer?.delinquent ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-medium bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                      delinquent
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                      good
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
