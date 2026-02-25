interface StripeResource {
  id: string
  title?: string
  text?: any
  url?: string
}

interface StripeResourcesOutputProps {
  resources: StripeResource[]
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100)
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getResourceType(id: string): string {
  if (id.startsWith("sub_")) return "Subscription"
  if (id.startsWith("cus_")) return "Customer"
  if (id.startsWith("in_")) return "Invoice"
  if (id.startsWith("pi_")) return "Payment"
  if (id.startsWith("price_")) return "Price"
  if (id.startsWith("prod_")) return "Product"
  return "Resource"
}

function getResourceLink(id: string): string {
  if (id.startsWith("sub_")) return `https://dashboard.stripe.com/subscriptions/${id}`
  if (id.startsWith("cus_")) return `https://dashboard.stripe.com/customers/${id}`
  if (id.startsWith("in_")) return `https://dashboard.stripe.com/invoices/${id}`
  if (id.startsWith("pi_")) return `https://dashboard.stripe.com/payments/${id}`
  if (id.startsWith("price_")) return `https://dashboard.stripe.com/prices/${id}`
  if (id.startsWith("prod_")) return `https://dashboard.stripe.com/products/${id}`
  return `https://dashboard.stripe.com/search?query=${id}`
}

export function StripeResourcesOutput({ resources }: StripeResourcesOutputProps) {
  if (!resources || resources.length === 0) {
    return <div className="text-[13px] text-black/50 dark:text-white/50 py-2">No resources found</div>
  }

  return (
    <div className="border border-black/[0.06] dark:border-white/[0.08] rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="bg-black/[0.02] dark:bg-white/[0.02] sticky top-0 z-10">
          <tr className="border-b border-black/[0.06] dark:border-white/[0.08]">
            <th className="text-left px-3 py-2 font-medium text-black/50 dark:text-white/50">Type</th>
            <th className="text-left px-3 py-2 font-medium text-black/50 dark:text-white/50">Details</th>
            <th className="text-left px-3 py-2 font-medium text-black/50 dark:text-white/50">Status</th>
            <th className="text-right px-3 py-2 font-medium text-black/50 dark:text-white/50">Amount</th>
          </tr>
        </thead>
        <tbody>
          {resources.map((resource, index) => {
            const data = resource.text || resource
            const resourceId = resource.id || data.id || `resource-${index}`
            const resourceType = getResourceType(resourceId)
            const resourceUrl = resource.url || getResourceLink(resourceId)

            const status = data.status
            const amount = data.amount || data.total || data.items?.data?.[0]?.price?.unit_amount
            const currency = data.currency || "eur"
            const customer = data.customer
            const planName = data.items?.data?.[0]?.price?.nickname || data.description || data.name

            return (
              <tr
                key={resourceId}
                className="border-b border-black/[0.04] dark:border-white/[0.04] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors duration-100"
              >
                <td className="px-3 py-2">
                  <div className="text-black/70 dark:text-white/70 font-medium">{resourceType}</div>
                  <div className="font-mono text-[10px] text-black/40 dark:text-white/40">
                    <a
                      href={resourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-500 dark:hover:text-blue-400"
                    >
                      {resourceId}
                    </a>
                  </div>
                </td>
                <td className="px-3 py-2">
                  {planName && (
                    <div className="text-black/70 dark:text-white/70 max-w-[200px] truncate">{planName}</div>
                  )}
                  {customer && (
                    <div className="text-[10px] text-black/40 dark:text-white/40">
                      <a
                        href={`https://dashboard.stripe.com/customers/${customer}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-500 dark:hover:text-blue-400"
                      >
                        {customer}
                      </a>
                    </div>
                  )}
                  {data.created && !planName && !customer && (
                    <div className="text-black/50 dark:text-white/50">{formatDate(data.created)}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {status ? (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-medium ${
                        status === "active" || status === "succeeded" || status === "paid"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                          : status === "canceled" || status === "failed"
                            ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                            : status === "trialing" || status === "pending"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                              : "bg-black/[0.04] text-black/60 dark:bg-white/[0.06] dark:text-white/60"
                      }`}
                    >
                      {status}
                    </span>
                  ) : (
                    <span className="text-black/30 dark:text-white/30">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {amount ? (
                    <div className="font-semibold text-black/80 dark:text-white/80">
                      {formatAmount(amount, currency)}
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
  )
}
