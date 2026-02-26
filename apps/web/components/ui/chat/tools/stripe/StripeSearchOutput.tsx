interface StripeSearchOutputProps {
  results: any[]
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100)
}

function parseAmountFromText(text: string): { amount: number; currency: string } | null {
  const match = text.match(/amount (\d+) and currency (\w+)/)
  if (match) {
    return {
      amount: parseInt(match[1], 10),
      currency: match[2],
    }
  }
  return null
}

function getResourceType(title: string, id: string): string {
  if (id.startsWith("pi_")) return "Payment"
  if (id.startsWith("sub_")) return "Subscription"
  if (id.startsWith("cus_")) return "Customer"
  if (id.startsWith("in_")) return "Invoice"
  if (id.startsWith("ch_")) return "Charge"

  if (title.includes("Subscription")) return "Subscription"
  if (title.includes("Payment")) return "Payment"
  if (title.includes("Customer")) return "Customer"
  if (title.includes("Invoice")) return "Invoice"

  return "Resource"
}

export function StripeSearchOutput({ results }: StripeSearchOutputProps) {
  if (!results || results.length === 0) {
    return <div className="text-[13px] text-black/50 dark:text-white/50 py-2">No results found</div>
  }

  return (
    <div className="space-y-2">
      <div className="text-[11px] text-black/40 dark:text-white/40">
        {results.length} {results.length === 1 ? "result" : "results"}
      </div>

      <div className="border border-black/[0.06] dark:border-white/[0.08] rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-black/[0.02] dark:bg-white/[0.02] sticky top-0 z-10">
            <tr className="border-b border-black/[0.06] dark:border-white/[0.08]">
              <th className="text-left px-3 py-2 font-medium text-black/50 dark:text-white/50">Result</th>
              <th className="text-left px-3 py-2 font-medium text-black/50 dark:text-white/50">Type</th>
              <th className="text-right px-3 py-2 font-medium text-black/50 dark:text-white/50">Amount</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, index) => {
              const amountData = parseAmountFromText(result.text || "")
              const resourceType = getResourceType(result.title || "", result.id || "")

              return (
                <tr
                  key={result.id || `result-${index}`}
                  className="border-b border-black/[0.04] dark:border-white/[0.04] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors duration-100"
                >
                  <td className="px-3 py-2">
                    <div className="text-black/70 dark:text-white/70 font-medium mb-0.5">
                      {result.title || "Result"}
                    </div>
                    {result.id && (
                      <div className="font-mono text-[10px] text-black/40 dark:text-white/40">
                        <a
                          href={result.url || "https://dashboard.stripe.com"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-500 dark:hover:text-blue-400"
                        >
                          {result.id}
                        </a>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-medium bg-black/[0.04] dark:bg-white/[0.06] text-black/60 dark:text-white/60">
                      {resourceType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {amountData ? (
                      <div className="font-semibold text-black/80 dark:text-white/80">
                        {formatAmount(amountData.amount, amountData.currency)}
                      </div>
                    ) : (
                      <span className="text-black/30 dark:text-white/30">—</span>
                    )}
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
