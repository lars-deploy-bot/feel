/**
 * Dynamic integrations list component
 *
 * Displays available integrations based on database visibility rules.
 * Uses popup-based OAuth flow to keep the user in the settings modal.
 */

"use client"

import { useEffect } from "react"
import toast from "react-hot-toast"
import { useIntegrations, useDisconnectIntegration, useConnectIntegration } from "@/hooks/use-integrations"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react"

interface IntegrationsListProps {
  layout?: "grid" | "list"
  filter?: string
}

export function IntegrationsList({ layout = "grid", filter }: IntegrationsListProps) {
  const { integrations, loading, error, refetch } = useIntegrations()

  // Auto-refresh when OAuth callback succeeds (for non-popup fallback)
  const urlSearchParams = typeof window !== "undefined" ? window.location.search : ""
  useEffect(() => {
    const params = new URLSearchParams(urlSearchParams)
    const integration = params.get("integration")
    const status = params.get("status")

    if (integration && status === "success") {
      // OAuth just succeeded - refetch to show "Connected" status immediately
      refetch()
      // Clean up URL params
      const url = new URL(window.location.href)
      url.searchParams.delete("integration")
      url.searchParams.delete("status")
      url.searchParams.delete("message")
      window.history.replaceState({}, "", url.toString())
    }
  }, [urlSearchParams, refetch])

  // Filter integrations if filter prop provided
  const filteredIntegrations = filter ? integrations.filter(i => i.provider_key === filter) : integrations

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading integrations...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        {/* Icon with subtle animation */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-orange-500/10 dark:bg-orange-400/10 rounded-full blur-xl animate-pulse" />
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 dark:from-orange-400/20 dark:to-red-400/20 flex items-center justify-center border border-orange-200/50 dark:border-orange-700/30">
            <AlertCircle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          </div>
        </div>

        {/* Heading */}
        <h3 className="text-xl font-semibold text-black dark:text-white mb-2">Connection Issue</h3>

        {/* Error message */}
        <p className="text-sm text-black/70 dark:text-white/70 max-w-md mb-1">
          We couldn't load your integrations right now.
        </p>

        {/* Technical details (collapsed by default feel) */}
        <details className="text-xs text-black/50 dark:text-white/50 max-w-md mb-8 cursor-pointer">
          <summary className="hover:text-black/70 dark:hover:text-white/70 transition-colors">
            Technical details
          </summary>
          <code className="block mt-2 p-2 bg-black/5 dark:bg-white/5 rounded text-left font-mono">{error}</code>
        </details>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={refetch}
            className="min-w-[140px] bg-black dark:bg-white text-white dark:text-black hover:bg-black/80 dark:hover:bg-white/80"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Retry
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()} className="min-w-[140px]">
            Refresh Page
          </Button>
        </div>

        {/* Helpful hint */}
        <p className="text-xs text-black/40 dark:text-white/40 mt-8">
          If this persists, try refreshing the page or contact support
        </p>
      </div>
    )
  }

  if (filteredIntegrations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mb-4">
          <AlertCircle className="h-6 w-6 text-black/40 dark:text-white/40" />
        </div>
        <h3 className="text-lg font-semibold text-black dark:text-white mb-2">No Integrations Available</h3>
        <p className="text-sm text-black/60 dark:text-white/60 max-w-md mb-6">
          You don't have access to any integrations yet. Integrations allow you to connect external services like
          Linear, GitHub, and more to enhance your workflow.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.open("mailto:support@goalive.nl?subject=Request%20Integration%20Access", "_blank")
            }}
          >
            Request Access
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Could link to docs about integrations
              console.log("Learn more about integrations")
            }}
          >
            Learn More
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={layout === "grid" ? "grid gap-6 grid-cols-1 sm:grid-cols-2" : "space-y-3"}>
      {filteredIntegrations.map(integration => (
        <IntegrationCard key={integration.provider_key} integration={integration} onUpdate={refetch} layout={layout} />
      ))}
    </div>
  )
}

interface IntegrationCardProps {
  integration: {
    provider_key: string
    display_name: string
    logo_path: string | null
    is_connected: boolean
    visibility_status: string
  }
  onUpdate: () => void
  layout?: "grid" | "list"
}

function IntegrationCard({ integration, onUpdate, layout = "grid" }: IntegrationCardProps) {
  const { disconnect, disconnecting, error: disconnectError } = useDisconnectIntegration(integration.provider_key)
  const { connect, connecting, error: connectError } = useConnectIntegration(integration.provider_key)

  const error = disconnectError || connectError

  const handleConnect = async () => {
    console.log("[IntegrationCard] handleConnect called for", integration.provider_key)
    const success = await connect()
    console.log("[IntegrationCard] connect() returned:", success)
    if (success) {
      console.log("[IntegrationCard] Calling onUpdate/refetch")
      toast.success(`${integration.display_name} connected`, {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      })
      onUpdate() // Refresh to show connected status
    }
  }

  const handleDisconnect = async () => {
    await disconnect()
    toast.success(`${integration.display_name} disconnected`)
    onUpdate() // Refresh the list
  }

  // Logo with polished styling
  const logoElement = integration.logo_path ? (
    <div className="relative group/logo">
      <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-black/10 dark:from-white/5 dark:to-white/10 rounded-lg blur group-hover/logo:blur-md transition-all" />
      <img
        src={integration.logo_path}
        alt={`${integration.display_name} logo`}
        className="relative h-10 w-10 rounded-lg object-contain p-1 bg-white dark:bg-black/20 border border-black/5 dark:border-white/10 shadow-sm"
      />
    </div>
  ) : (
    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-black/5 to-black/10 dark:from-white/5 dark:to-white/10 flex items-center justify-center border border-black/5 dark:border-white/10 flex-shrink-0">
      <span className="text-sm font-semibold bg-gradient-to-br from-black/70 to-black/50 dark:from-white/70 dark:to-white/50 bg-clip-text text-transparent">
        {integration.display_name.slice(0, 2).toUpperCase()}
      </span>
    </div>
  )

  // Compact list layout for modal
  if (layout === "list") {
    return (
      <div
        className={`group relative rounded-xl border transition-all duration-300 overflow-hidden ${
          integration.is_connected
            ? "border-emerald-500/20 dark:border-emerald-400/20 bg-gradient-to-br from-emerald-50/50 to-green-50/30 dark:from-emerald-950/10 dark:to-green-950/5 hover:border-emerald-500/40 dark:hover:border-emerald-400/40 hover:shadow-lg hover:shadow-emerald-500/5"
            : "border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900/50 hover:border-black/20 dark:hover:border-white/20 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-white/5"
        }`}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Logo */}
            <div className="relative">
              {logoElement}
              {integration.is_connected && (
                <div className="absolute -top-1 -right-1">
                  <div className="relative">
                    <div className="absolute inset-0 bg-emerald-500 rounded-full blur-sm animate-pulse" />
                    <div className="relative w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm" />
                  </div>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Title & Status */}
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-semibold text-black dark:text-white truncate">
                  {integration.display_name}
                </h4>
                {/* Only show "Early Access" for beta - if you can see it, you have access */}
                {integration.visibility_status === "beta" && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gradient-to-r from-purple-500/10 to-blue-500/10 text-purple-700 dark:text-purple-300 rounded border border-purple-200/50 dark:border-purple-700/30">
                    Early Access
                  </span>
                )}
              </div>

              {/* Status text */}
              <p className="text-xs text-black/60 dark:text-white/60 mb-3">
                {integration.is_connected ? (
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-400">Connected and active</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 bg-black/20 dark:bg-white/20 rounded-full" />
                    Ready to connect
                  </span>
                )}
              </p>

              {/* Error alert - polished */}
              {error && (
                <div className="mb-3 px-3 py-2.5 rounded-lg bg-gradient-to-br from-orange-50 to-red-50/50 dark:from-orange-950/20 dark:to-red-950/10 border border-orange-200/50 dark:border-orange-800/30">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-orange-900 dark:text-orange-300 leading-relaxed font-medium">{error}</p>
                  </div>
                </div>
              )}

              {/* Action button */}
              {integration.is_connected ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-black/20 dark:border-white/20 text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {disconnecting ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Disconnecting...
                    </span>
                  ) : (
                    "Disconnect"
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-black dark:bg-white text-white dark:text-black hover:bg-black/80 dark:hover:bg-white/80 transition-all duration-200 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {connecting ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Connecting...
                    </span>
                  ) : (
                    "Connect"
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Standard grid layout for full page
  return (
    <div
      className={`group relative rounded-xl border transition-all duration-300 overflow-hidden hover:shadow-xl ${
        integration.is_connected
          ? "border-emerald-500/20 dark:border-emerald-400/20 bg-gradient-to-br from-emerald-50/30 to-white dark:from-emerald-950/10 dark:to-zinc-900 hover:border-emerald-500/40 hover:shadow-emerald-500/10"
          : "border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 hover:border-black/20 dark:hover:border-white/20"
      }`}
    >
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            {logoElement}
            <div>
              <h3 className="text-lg font-semibold text-black dark:text-white">{integration.display_name}</h3>
              <p className="text-sm text-black/50 dark:text-white/50 font-mono">{integration.provider_key}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {integration.is_connected ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-400/10 border border-emerald-500/20 dark:border-emerald-400/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                <span className="inline-block w-1.5 h-1.5 bg-black/20 dark:bg-white/20 rounded-full" />
                <span className="text-xs font-medium text-black/60 dark:text-white/60">Not Connected</span>
              </div>
            )}
            {integration.visibility_status === "beta" && (
              <div className="px-2 py-1 text-[10px] font-semibold bg-gradient-to-r from-purple-500/10 to-blue-500/10 text-purple-700 dark:text-purple-300 rounded-full border border-purple-200/50 dark:border-purple-700/30">
                Early Access
              </div>
            )}
          </div>
        </div>

        {/* Error - polished */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-gradient-to-br from-orange-50 to-red-50/50 dark:from-orange-950/20 dark:to-red-950/10 border border-orange-200/50 dark:border-orange-800/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-orange-900 dark:text-orange-300 leading-relaxed font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-black/70 dark:text-white/70 leading-relaxed">
          {integration.is_connected
            ? `Your ${integration.display_name} account is connected and ready to use.`
            : `Connect your ${integration.display_name} account to enable this integration.`}
        </p>
      </div>

      {/* Footer with action */}
      <div className="px-6 pb-6">
        {integration.is_connected ? (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="w-full px-4 py-2.5 text-sm font-medium rounded-lg border-2 border-black/10 dark:border-white/10 text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
          >
            {disconnecting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Disconnecting...
              </span>
            ) : (
              "Disconnect"
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-black to-black/90 dark:from-white dark:to-white/90 text-white dark:text-black hover:shadow-lg hover:shadow-black/20 dark:hover:shadow-white/20 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
          >
            {connecting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting...
              </span>
            ) : (
              `Connect ${integration.display_name}`
            )}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Single integration status component
 * Useful for showing a specific integration's status
 */
export function IntegrationStatus({ providerKey }: { providerKey: string }) {
  const { integrations, loading } = useIntegrations()

  if (loading) {
    return <Loader2 className="h-4 w-4 animate-spin" />
  }

  const integration = integrations.find(i => i.provider_key === providerKey)

  if (!integration) {
    return null // Integration not available for this user
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{integration.display_name}:</span>
      {integration.is_connected ? (
        <Badge variant="default" className="bg-green-500">
          Connected
        </Badge>
      ) : (
        <Badge variant="secondary">Not Connected</Badge>
      )}
    </div>
  )
}
