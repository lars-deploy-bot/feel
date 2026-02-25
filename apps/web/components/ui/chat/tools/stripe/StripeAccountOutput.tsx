interface StripeAccountOutputProps {
  account: any
}

export function StripeAccountOutput({ account }: StripeAccountOutputProps) {
  if (!account) {
    return <div className="text-[13px] text-black/50 dark:text-white/50 py-2">No account data</div>
  }

  return (
    <div className="py-1">
      <p className="text-[13px] font-medium text-black/80 dark:text-white/80">
        {account.display_name || "Stripe Account"}
      </p>
      {account.account_id && (
        <p className="text-[11px] text-black/40 dark:text-white/40 mt-0.5">
          <a
            href="https://dashboard.stripe.com/settings/account"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono hover:text-blue-500 dark:hover:text-blue-400"
          >
            {account.account_id}
          </a>
        </p>
      )}
    </div>
  )
}
