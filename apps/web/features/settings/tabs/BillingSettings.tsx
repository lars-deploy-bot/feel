"use client"

import { useQuery } from "@tanstack/react-query"
import { ExternalLink } from "lucide-react"
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { getty, postty } from "@/lib/api/api-client"
import type { Res } from "@/lib/api/schemas"
import { validateRequest } from "@/lib/api/schemas"
import { useCredits, useCreditsError, useCreditsLoading, useUserActions } from "@/lib/providers/UserStoreProvider"
import { useCurrentWorkspace } from "@/lib/stores/workspaceStore"
import { smallButton, text } from "../styles"
import { SettingsTabLayout } from "./SettingsTabLayout"

// ---------------------------------------------------------------------------
// Error boundary — billing errors shouldn't crash settings
// ---------------------------------------------------------------------------

class BillingErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[BillingErrorBoundary]", error.message, info.componentStack)
  }
  render() {
    if (this.state.hasError) {
      return (
        <SettingsTabLayout title="Billing" description="Plan, credits, and payment">
          <p className={text.muted}>Couldn't load billing — try refreshing</p>
        </SettingsTabLayout>
      )
    }
    return this.props.children
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(cents: number, currency: string): string {
  const amount = (cents / 100).toFixed(2).replace(/\.00$/, "")
  const symbol = currency.toUpperCase() === "EUR" ? "\u20ac" : currency.toUpperCase() === "USD" ? "$" : currency
  return `${symbol}${amount}`
}

// ---------------------------------------------------------------------------
// Inner billing content
// ---------------------------------------------------------------------------

function BillingContent() {
  const credits = useCredits()
  const creditsLoading = useCreditsLoading()
  const creditsError = useCreditsError()
  const { fetchCredits } = useUserActions()
  const workspace = useCurrentWorkspace()
  const [isCheckingOut, setIsCheckingOut] = useState(false)

  useEffect(() => {
    if (workspace) fetchCredits(workspace)
  }, [fetchCredits, workspace])

  // Fetch billing state from Polar via our API
  const {
    data: billing,
    isLoading: billingLoading,
    isError: billingError,
  } = useQuery<Res<"polar/billing">>({
    queryKey: ["polar-billing"],
    queryFn: () => getty("polar/billing"),
    staleTime: 60_000,
    retry: 1,
  })

  const billingLoaded = !billingLoading && !billingError && billing != null
  const sub = billing?.subscription
  const hasSub = sub != null
  const planName = hasSub ? "Pro" : "Free"
  const planStatus = sub?.status ?? "active"

  const subscriptionProduct = billing?.products.find(p => p.isRecurring)
  const topUpProduct = billing?.products.find(p => !p.isRecurring)

  const handleCheckout = async (productId: string) => {
    setIsCheckingOut(true)
    try {
      const validated = validateRequest("polar/checkout", { productId })
      const data = await postty("polar/checkout", validated)
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      toast.error("Checkout failed — please try again")
    } finally {
      setIsCheckingOut(false)
    }
  }

  // Credits display (independent of Polar)
  const creditsValue = creditsLoading ? null : creditsError ? null : credits
  const isLow = creditsValue != null && creditsValue < 5

  return (
    <SettingsTabLayout title="Billing" description="Plan, credits, and payment">
      <div className="space-y-5">
        {/* ================================================================
            PLAN
            ================================================================ */}
        {!billingLoaded ? (
          <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] p-5">
            <div className="h-3 w-12 rounded bg-black/[0.04] dark:bg-white/[0.04] animate-pulse" />
            <div className="h-6 w-28 rounded bg-black/[0.04] dark:bg-white/[0.04] animate-pulse mt-2.5" />
          </div>
        ) : (
          <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.06] p-5 animate-in fade-in-0 duration-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-black/40 dark:text-white/40">Plan</p>
                <div className="flex items-center gap-2.5 mt-1.5">
                  <span className="text-xl font-semibold text-black/90 dark:text-white/90">{planName}</span>
                  {!hasSub ? (
                    <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-black/[0.05] dark:bg-white/[0.05] text-black/40 dark:text-white/40">
                      Free
                    </span>
                  ) : (
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full ${
                        planStatus === "active"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : planStatus === "past_due"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-red-500/10 text-red-600 dark:text-red-400"
                      }`}
                    >
                      {planStatus === "active" ? "Active" : planStatus === "past_due" ? "Past due" : planStatus}
                    </span>
                  )}
                </div>
              </div>
              {billing.portalUrl && (
                <a href={billing.portalUrl} target="_blank" rel="noopener noreferrer" className={smallButton}>
                  Manage
                  <ExternalLink size={11} className="ml-1.5 opacity-40" />
                </a>
              )}
            </div>

            {/* Upgrade nudge — only when credits are running low */}
            {!hasSub && isLow && subscriptionProduct && (
              <div className="mt-4 pt-4 border-t border-black/[0.05] dark:border-white/[0.05] flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-black/80 dark:text-white/80">Need more credits?</p>
                  <p className="text-xs text-black/40 dark:text-white/40 mt-0.5">
                    {subscriptionProduct.name}
                    {subscriptionProduct.prices[0]?.priceAmount != null &&
                      ` \u00b7 ${formatPrice(subscriptionProduct.prices[0].priceAmount, subscriptionProduct.prices[0].priceCurrency ?? "usd")}/mo`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCheckout(subscriptionProduct.id)}
                  disabled={isCheckingOut}
                  className="inline-flex items-center justify-center h-9 px-5 bg-black dark:bg-white text-white dark:text-black text-sm font-medium rounded-xl hover:brightness-[0.85] active:brightness-75 active:scale-[0.98] transition-all duration-150 disabled:opacity-30"
                >
                  {isCheckingOut ? "..." : "Upgrade"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================================================================
            CREDITS
            ================================================================ */}
        <div
          className={`rounded-2xl border p-5 animate-in fade-in-0 slide-in-from-left-2 duration-200 ${
            isLow ? "border-amber-500/20 bg-amber-500/[0.03]" : "border-black/[0.06] dark:border-white/[0.06]"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-black/40 dark:text-white/40">Credits</p>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-3xl font-semibold tabular-nums text-black/90 dark:text-white/90">
                  {creditsValue != null ? creditsValue.toFixed(0) : "\u2014"}
                </span>
                {creditsValue != null && (
                  <span className="text-sm text-black/30 dark:text-white/30">
                    .{creditsValue.toFixed(2).split(".")[1]}
                  </span>
                )}
              </div>
              {isLow && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Running low</p>}
            </div>
            {topUpProduct ? (
              <button
                type="button"
                onClick={() => handleCheckout(topUpProduct.id)}
                disabled={isCheckingOut}
                className={
                  isLow
                    ? "inline-flex items-center justify-center h-9 px-5 bg-amber-600 text-white text-sm font-medium rounded-xl hover:bg-amber-700 active:scale-[0.98] transition-all duration-150 disabled:opacity-30"
                    : smallButton
                }
              >
                {isCheckingOut
                  ? "..."
                  : `Buy credits${topUpProduct.prices[0]?.priceAmount != null ? ` \u00b7 ${formatPrice(topUpProduct.prices[0].priceAmount, topUpProduct.prices[0].priceCurrency ?? "usd")}` : ""}`}
              </button>
            ) : !billingLoaded ? (
              <div className="h-8 w-28 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] animate-pulse" />
            ) : null}
          </div>
        </div>
      </div>
    </SettingsTabLayout>
  )
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function BillingSettings() {
  return (
    <BillingErrorBoundary>
      <BillingContent />
    </BillingErrorBoundary>
  )
}
