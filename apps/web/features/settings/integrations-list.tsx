/**
 * Dynamic integrations list component
 *
 * Displays available integrations based on database visibility rules.
 * Uses popup-based OAuth flow to keep the user in the settings modal.
 */

"use client"

import {
  getProviderInfo,
  isValidOAuthMcpProviderKey,
  providerSupportsOAuth,
  providerSupportsPat,
} from "@webalive/shared"
import { AlertCircle, CheckCircle2, ExternalLink, Key, Loader2, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  useConnectIntegration,
  useConnectWithPat,
  useDisconnectIntegration,
  useIntegrations,
} from "@/hooks/use-integrations"
import {
  trackIntegrationConnected,
  trackIntegrationDisconnected,
  trackIntegrationsViewed,
} from "@/lib/analytics/events"
import { getIntegrationUI } from "@/lib/integrations/registry"

// Constants
const VISIBILITY_STATUS = {
  BETA: "beta",
} as const

const TOKEN_STATUS = {
  NEEDS_REAUTH: "needs_reauth",
} as const

/**
 * Early Access badge component
 */
function EarlyAccessBadge({ size = "default" }: { size?: "default" | "small" }) {
  const sizeClasses = size === "small" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[10px]"

  return (
    <span
      className={`${sizeClasses} font-medium bg-gradient-to-r from-purple-500/10 to-blue-500/10 text-purple-700 dark:text-purple-300 rounded${size === "small" ? "" : "-full"} border border-purple-200/50 dark:border-purple-700/30`}
    >
      Early Access
    </span>
  )
}

/**
 * Error alert component
 */
function ErrorAlert({ error, size = "default" }: { error: string; size?: "default" | "small" }) {
  const sizeClasses = {
    small: {
      container: "mb-3 px-3 py-2.5",
      icon: "h-3.5 w-3.5",
      text: "text-xs",
    },
    default: {
      container: "mb-4 px-4 py-3",
      icon: "h-4 w-4",
      text: "text-sm",
    },
  }

  const classes = sizeClasses[size]

  return (
    <div
      className={`${classes.container} rounded-lg bg-gradient-to-br from-orange-50 to-red-50/50 dark:from-orange-950/20 dark:to-red-950/10 border border-orange-200/50 dark:border-orange-800/30`}
    >
      <div className="flex items-start gap-2">
        <AlertCircle className={`${classes.icon} text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5`} />
        <p className={`${classes.text} text-orange-900 dark:text-orange-300 leading-relaxed font-medium`}>{error}</p>
      </div>
    </div>
  )
}

// Card styles only used for compact "list" layout in modals
function getCompactCardStyles(tokenStatus: string | undefined, isConnected: boolean) {
  const base =
    "group relative rounded-xl border transition-colors duration-100 overflow-hidden bg-white dark:bg-zinc-900"

  if (tokenStatus === TOKEN_STATUS.NEEDS_REAUTH) {
    return `${base} border-orange-500/30 dark:border-orange-400/30`
  }

  if (isConnected) {
    return `${base} border-emerald-500/20 dark:border-emerald-400/20`
  }

  return `${base} border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20`
}

interface IntegrationsListProps {
  layout?: "grid" | "list"
  filter?: string
}

export function IntegrationsList({ layout = "grid", filter }: IntegrationsListProps) {
  const { integrations, loading, error, refetch } = useIntegrations()

  useEffect(() => {
    trackIntegrationsViewed()
  }, [])

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
      url.searchParams.delete("error_code")
      url.searchParams.delete("error_action")
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
            <RefreshCw className="w-4 h-4 mr-2" />
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
              window.open("mailto:team@alive.best?subject=Request%20Integration%20Access", "_blank")
            }}
          >
            Request Access
          </Button>
        </div>
      </div>
    )
  }

  // Compact list layout (for modals) — no split panel
  if (layout === "list") {
    return (
      <div className="space-y-3">
        {filteredIntegrations.map(integration => (
          <IntegrationCard key={integration.provider_key} integration={integration} onUpdate={refetch} layout="list" />
        ))}
      </div>
    )
  }

  // Master-detail split layout (settings page)
  return <IntegrationsMasterDetail integrations={filteredIntegrations} onUpdate={refetch} />
}

type IntegrationData = {
  provider_key: string
  display_name: string
  logo_path: string | null
  is_connected: boolean
  visibility_status: string
  token_status?: "valid" | "expired" | "needs_reauth" | "not_connected"
  status_message?: string
}

interface IntegrationCardProps {
  integration: IntegrationData
  onUpdate: () => void
  layout?: "grid" | "list"
}

/**
 * Capitalize first letter of a tool name
 */
function formatToolName(tool: string): string {
  return tool.charAt(0).toUpperCase() + tool.slice(1)
}

/**
 * Master-detail layout for the settings page — full width, expansive
 */
function IntegrationsMasterDetail({
  integrations,
  onUpdate,
}: {
  integrations: IntegrationData[]
  onUpdate: () => void
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(integrations[0]?.provider_key ?? null)
  const selected = integrations.find(i => i.provider_key === selectedKey)

  return (
    <div className="flex min-h-[500px]">
      {/* Left nav — slim, clean */}
      <div className="w-[260px] flex-shrink-0 border-r border-black/[0.06] dark:border-white/[0.06] pr-5">
        {/* Security info */}
        <div className="mb-4 px-3 py-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04]">
          <p className="text-[12px] leading-relaxed text-black/50 dark:text-white/50">
            <span className="font-medium text-black/70 dark:text-white/70">Your tokens are private.</span> Encrypted at
            rest with AES-256-GCM. Only you can access your connected accounts.
          </p>
        </div>

        <div className="space-y-0.5">
          {integrations.map(integration => {
            const isSelected = integration.provider_key === selectedKey
            return (
              <button
                key={integration.provider_key}
                type="button"
                onClick={() => setSelectedKey(integration.provider_key)}
                className={`w-full text-left py-2.5 px-3 flex items-center gap-3 rounded-lg transition-colors duration-100 ${
                  isSelected
                    ? "bg-black/[0.04] dark:bg-white/[0.04]"
                    : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                }`}
              >
                {integration.logo_path ? (
                  <img src={integration.logo_path} alt="" className="h-7 w-7 object-contain flex-shrink-0" />
                ) : (
                  <div className="h-7 w-7 rounded-md bg-black/[0.04] dark:bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-semibold text-black/40 dark:text-white/40">
                      {integration.display_name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
                <span
                  className={`flex-1 text-[13px] truncate ${
                    isSelected ? "font-medium text-black/90 dark:text-white/90" : "text-black/60 dark:text-white/60"
                  }`}
                >
                  {integration.display_name}
                </span>
                {integration.is_connected && integration.token_status !== TOKEN_STATUS.NEEDS_REAUTH && (
                  <span className="size-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                )}
                {integration.token_status === TOKEN_STATUS.NEEDS_REAUTH && (
                  <span className="size-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Right detail — expansive */}
      <div className="flex-1 pl-8 overflow-y-auto">
        {selected ? (
          <IntegrationDetail integration={selected} onUpdate={onUpdate} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-[13px] text-black/30 dark:text-white/30">Select an integration</p>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Detail panel for a selected integration — expansive and capability-focused
 */
function IntegrationDetail({ integration, onUpdate }: { integration: IntegrationData; onUpdate: () => void }) {
  const { disconnect, disconnecting, error: disconnectError } = useDisconnectIntegration(integration.provider_key)
  const {
    connect,
    connecting,
    error: connectError,
  } = useConnectIntegration(integration.provider_key, {
    isReconnect: integration.token_status === TOKEN_STATUS.NEEDS_REAUTH,
  })

  const error = disconnectError || connectError
  const supportsPat = providerSupportsPat(integration.provider_key)
  const supportsOAuth = providerSupportsOAuth(integration.provider_key)
  const supportsBoth = supportsPat && supportsOAuth
  const providerInfo = getProviderInfo(integration.provider_key)
  const isConnected = integration.is_connected && integration.token_status !== TOKEN_STATUS.NEEDS_REAUTH

  const handleConnect = async () => {
    const success = await connect()
    if (success) {
      trackIntegrationConnected(integration.provider_key)
      toast.success(`${integration.display_name} connected`, {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      })
      onUpdate()
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
      trackIntegrationDisconnected(integration.provider_key)
      toast.success(`${integration.display_name} disconnected`)
      onUpdate()
    } catch {
      // Error handled by mutation's onError callback
    }
  }

  return (
    <div>
      {/* Header — large, confident */}
      <div className="flex items-start gap-5">
        {integration.logo_path ? (
          <img src={integration.logo_path} alt="" className="h-14 w-14 object-contain flex-shrink-0" />
        ) : (
          <div className="h-14 w-14 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] flex items-center justify-center flex-shrink-0">
            <span className="text-base font-semibold text-black/40 dark:text-white/40">
              {integration.display_name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="text-lg font-semibold text-black/90 dark:text-white/90">{integration.display_name}</h3>
          {providerInfo?.description && (
            <p className="text-[13px] text-black/50 dark:text-white/50 mt-1 leading-relaxed max-w-lg">
              {providerInfo.description}
            </p>
          )}
        </div>
      </div>

      {/* Status + action — stacked */}
      <div className="mt-5 pb-6 border-b border-black/[0.06] dark:border-white/[0.06]">
        {integration.token_status === TOKEN_STATUS.NEEDS_REAUTH ? (
          <p className="flex items-center gap-2 text-[13px] text-black/50 dark:text-white/50 mb-3">
            <span className="size-2 rounded-full bg-orange-400 flex-shrink-0" />
            <span>
              <span className="font-medium text-black/70 dark:text-white/70">Expired</span> —{" "}
              {integration.status_message || "reconnect to keep using this integration."}
            </span>
          </p>
        ) : isConnected ? (
          <span className="flex items-center gap-2 text-[13px] text-emerald-600 dark:text-emerald-400 mb-3">
            <span className="size-2 rounded-full bg-emerald-500" />
            Connected
          </span>
        ) : (
          <span className="flex items-center gap-2 text-[13px] text-black/35 dark:text-white/35 mb-3">
            <span className="size-2 rounded-full bg-black/10 dark:bg-white/10" />
            Not connected
          </span>
        )}

        {integration.token_status === TOKEN_STATUS.NEEDS_REAUTH ? (
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="px-4 py-2 text-[13px] font-medium rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-black/70 dark:text-white/70 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {connecting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Reconnecting...
              </span>
            ) : (
              "Reconnect"
            )}
          </button>
        ) : isConnected ? (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="px-3.5 py-1.5 text-[13px] font-medium rounded-lg text-black/50 dark:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {disconnecting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
            className="px-4 py-2 text-[13px] font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {connecting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Connecting...
              </span>
            ) : (
              "Connect"
            )}
          </button>
        )}
      </div>

      {/* Alternative connection method — only when not connected and supports PAT */}
      {!isConnected && integration.token_status !== TOKEN_STATUS.NEEDS_REAUTH && (supportsPat || supportsBoth) && (
        <DetailPatInput
          providerKey={integration.provider_key}
          displayName={integration.display_name}
          onSuccess={onUpdate}
        />
      )}

      {/* Error */}
      {error && (
        <div className="pt-4">
          <ErrorAlert error={error} size="small" />
        </div>
      )}

      {/* Tools — capability grid */}
      {providerInfo && providerInfo.tools.length > 0 && (
        <div className="pt-6">
          <p className="text-[11px] font-medium text-black/40 dark:text-white/40 uppercase tracking-wider mb-4">
            {providerInfo.tools.length} available tools
          </p>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
            {providerInfo.tools.map(tool => (
              <div
                key={tool}
                className={`px-3.5 py-2.5 text-[13px] rounded-lg transition-colors duration-100 ${
                  isConnected
                    ? "bg-black/[0.03] dark:bg-white/[0.03] text-black/80 dark:text-white/80"
                    : "bg-black/[0.02] dark:bg-white/[0.02] text-black/25 dark:text-white/25"
                }`}
              >
                {formatToolName(tool)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Integration UI component when connected */}
      {renderIntegrationUI(integration, "grid")}
    </div>
  )
}

/**
 * Collapsed PAT input for the detail panel — shows as a subtle link, expands on click
 */
function DetailPatInput({
  providerKey,
  displayName,
  onSuccess,
}: {
  providerKey: string
  displayName: string
  onSuccess: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [token, setToken] = useState("")
  const { connectWithPat, connecting, error, clearError } = useConnectWithPat(providerKey)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) return
    const result = await connectWithPat(token.trim())
    if (result.success) {
      toast.success(`Connected to ${displayName} as ${result.username}`, {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      })
      setToken("")
      setExpanded(false)
      onSuccess()
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => {
          setExpanded(true)
          clearError()
        }}
        className="mt-2 text-[12px] text-black/35 dark:text-white/35 hover:text-black/60 dark:hover:text-white/60 transition-colors duration-100"
      >
        Or connect with a personal access token
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
      <input
        type="password"
        value={token}
        onChange={e => setToken(e.target.value)}
        placeholder="Paste token..."
        className="flex-1 max-w-xs px-3 py-1.5 text-[13px] rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-transparent text-black dark:text-white placeholder:text-black/30 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-black/[0.08] dark:focus:ring-white/[0.08] transition-all duration-100"
      />
      <button
        type="submit"
        disabled={connecting || !token.trim()}
        className="px-3 py-1.5 text-[13px] font-medium rounded-lg bg-black dark:bg-white text-white dark:text-black hover:bg-black/80 dark:hover:bg-white/80 transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Connect"}
      </button>
      <button
        type="button"
        onClick={() => {
          setExpanded(false)
          setToken("")
          clearError()
        }}
        className="px-3 py-1.5 text-[13px] text-black/40 dark:text-white/40 hover:text-black/60 dark:hover:text-white/60 transition-colors duration-100"
      >
        Cancel
      </button>
      {error && <p className="text-[12px] text-red-600 dark:text-red-400 ml-1">{error}</p>}
    </form>
  )
}

/**
 * Helper function to render integration UI component when connected
 * Extracts the common logic for both list and grid layouts
 */
function renderIntegrationUI(integration: IntegrationCardProps["integration"], layout: "grid" | "list") {
  if (!integration.is_connected) return null

  const providerKey = integration.provider_key
  if (!isValidOAuthMcpProviderKey(providerKey)) return null

  const uiConfig = getIntegrationUI(providerKey)
  if (!uiConfig) return null

  const Component = uiConfig.component
  const limit = layout === "list" ? (uiConfig.compactLimit ?? 5) : (uiConfig.fullLimit ?? 8)
  const titleClass =
    layout === "list"
      ? "text-xs font-semibold text-black/70 dark:text-white/70 mb-3 uppercase tracking-wide"
      : "text-sm font-semibold text-black/70 dark:text-white/70 mb-4 uppercase tracking-wide"

  if (layout === "list") {
    return (
      <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
        <h5 className={titleClass}>{uiConfig.title}</h5>
        <Component compact={true} limit={limit} />
      </div>
    )
  }

  // Grid layout
  return (
    <div className="px-6 pb-6 pt-2">
      <div className="pt-4 border-t border-black/5 dark:border-white/5">
        <h5 className={titleClass}>{uiConfig.title}</h5>
        <Component compact={true} limit={limit} />
      </div>
    </div>
  )
}

/**
 * PAT Input Component for providers that support Personal Access Tokens
 */
function PatInput({
  providerKey,
  displayName,
  onSuccess,
  size = "default",
}: {
  providerKey: string
  displayName: string
  onSuccess: () => void
  size?: "default" | "small"
}) {
  const [token, setToken] = useState("")
  const [showInput, setShowInput] = useState(false)
  const { connectWithPat, connecting, error, clearError } = useConnectWithPat(providerKey)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) return

    const result = await connectWithPat(token.trim())
    if (result.success) {
      toast.success(`Connected to ${displayName} as ${result.username}`, {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      })
      setToken("")
      setShowInput(false)
      onSuccess()
    }
  }

  const sizeClasses = size === "small" ? "text-xs" : "text-sm"
  const inputPadding = size === "small" ? "px-2 py-1.5" : "px-3 py-2"
  const buttonPadding = size === "small" ? "px-3 py-1.5" : "px-4 py-2"

  if (!showInput) {
    return (
      <button
        type="button"
        onClick={() => {
          setShowInput(true)
          clearError()
        }}
        className={`${buttonPadding} ${sizeClasses} font-medium rounded-md bg-black dark:bg-white text-white dark:text-black hover:bg-black/80 dark:hover:bg-white/80 transition-all duration-200 active:scale-95 flex items-center gap-1.5`}
      >
        <Key className="h-3.5 w-3.5" />
        Connect with Token
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <input
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="ghp_xxxx or github_pat_xxxx"
          className={`flex-1 ${inputPadding} ${sizeClasses} rounded-md border border-black/20 dark:border-white/20 bg-white dark:bg-zinc-900 text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20`}
        />
        <button
          type="submit"
          disabled={connecting || !token.trim()}
          className={`${buttonPadding} ${sizeClasses} font-medium rounded-md bg-black dark:bg-white text-white dark:text-black hover:bg-black/80 dark:hover:bg-white/80 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Connect"}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowInput(false)
            setToken("")
            clearError()
          }}
          className={`${buttonPadding} ${sizeClasses} font-medium rounded-md border border-black/20 dark:border-white/20 text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200`}
        >
          Cancel
        </button>
      </div>
      {error && <p className={`${sizeClasses} text-red-600 dark:text-red-400`}>{error}</p>}
      <p className={`${sizeClasses} text-black/50 dark:text-white/50`}>
        <a
          href="https://github.com/settings/tokens"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white underline underline-offset-2"
        >
          Create a token on GitHub
          <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </form>
  )
}

/**
 * Dual Connection Options Component
 * Shows both OAuth and PAT options equally for providers that support both
 */
function DualConnectionOptions({
  providerKey,
  displayName,
  onOAuthConnect,
  onSuccess,
  connecting,
  size = "default",
}: {
  providerKey: string
  displayName: string
  onOAuthConnect: () => void
  onSuccess: () => void
  connecting: boolean
  size?: "default" | "small"
}) {
  const [showPatInput, setShowPatInput] = useState(false)
  const { connectWithPat, connecting: patConnecting, error: patError, clearError } = useConnectWithPat(providerKey)
  const [token, setToken] = useState("")

  const handlePatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) return

    const result = await connectWithPat(token.trim())
    if (result.success) {
      toast.success(`Connected to ${displayName} as ${result.username}`, {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      })
      setToken("")
      setShowPatInput(false)
      onSuccess()
    }
  }

  const sizeClasses = size === "small" ? "text-xs" : "text-sm"
  const buttonPadding = size === "small" ? "px-3 py-1.5" : "px-4 py-2"
  const inputPadding = size === "small" ? "px-2 py-1.5" : "px-3 py-2"

  if (showPatInput) {
    return (
      <form onSubmit={handlePatSubmit} className="space-y-2">
        <div className="flex gap-2">
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="ghp_xxxx or github_pat_xxxx"
            className={`flex-1 ${inputPadding} ${sizeClasses} rounded-md border border-black/20 dark:border-white/20 bg-white dark:bg-zinc-900 text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20`}
          />
          <button
            type="submit"
            disabled={patConnecting || !token.trim()}
            className={`${buttonPadding} ${sizeClasses} font-medium rounded-md bg-black dark:bg-white text-white dark:text-black hover:bg-black/80 dark:hover:bg-white/80 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {patConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Connect"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowPatInput(false)
              setToken("")
              clearError()
            }}
            className={`${buttonPadding} ${sizeClasses} font-medium rounded-md border border-black/20 dark:border-white/20 text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200`}
          >
            Cancel
          </button>
        </div>
        {patError && <p className={`${sizeClasses} text-red-600 dark:text-red-400`}>{patError}</p>}
        <p className={`${sizeClasses} text-black/50 dark:text-white/50`}>
          <a
            href="https://github.com/settings/tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white underline underline-offset-2"
          >
            Create a token on GitHub
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </form>
    )
  }

  // Show both buttons
  return (
    <div className="flex flex-col gap-2">
      <div className={size === "small" ? "flex gap-2" : "flex flex-col gap-2"}>
        {/* OAuth Button */}
        <button
          type="button"
          onClick={onOAuthConnect}
          disabled={connecting}
          className={`${size === "small" ? "flex-1" : "w-full"} ${buttonPadding} ${sizeClasses} font-medium rounded-md bg-black dark:bg-white text-white dark:text-black hover:bg-black/80 dark:hover:bg-white/80 transition-all duration-200 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-1.5`}
        >
          {connecting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <ExternalLink className="h-3.5 w-3.5" />
              Connect with OAuth
            </>
          )}
        </button>
        {/* PAT Button */}
        <button
          type="button"
          onClick={() => {
            setShowPatInput(true)
            clearError()
          }}
          className={`${size === "small" ? "flex-1" : "w-full"} ${buttonPadding} ${sizeClasses} font-medium rounded-md border border-black/20 dark:border-white/20 text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5`}
        >
          <Key className="h-3.5 w-3.5" />
          Use Token
        </button>
      </div>
    </div>
  )
}

/**
 * Compact integration card — used only in modal/sidebar "list" layout
 */
function IntegrationCard({ integration, onUpdate }: IntegrationCardProps) {
  const { disconnect, disconnecting, error: disconnectError } = useDisconnectIntegration(integration.provider_key)
  const {
    connect,
    connecting,
    error: connectError,
  } = useConnectIntegration(integration.provider_key, {
    isReconnect: integration.token_status === TOKEN_STATUS.NEEDS_REAUTH,
  })

  const error = disconnectError || connectError
  const supportsPat = providerSupportsPat(integration.provider_key)
  const supportsOAuth = providerSupportsOAuth(integration.provider_key)
  const supportsBoth = supportsPat && supportsOAuth
  const providerInfo = getProviderInfo(integration.provider_key)

  const handleConnect = async () => {
    const success = await connect()
    if (success) {
      trackIntegrationConnected(integration.provider_key)
      toast.success(`${integration.display_name} connected`, {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      })
      onUpdate()
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
      trackIntegrationDisconnected(integration.provider_key)
      toast.success(`${integration.display_name} disconnected`)
      onUpdate()
    } catch {
      // Error handled by mutation's onError callback
    }
  }

  const actionButton =
    integration.token_status === TOKEN_STATUS.NEEDS_REAUTH ? (
      <button
        type="button"
        onClick={handleConnect}
        disabled={connecting}
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {connecting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reconnect"}
      </button>
    ) : integration.is_connected ? (
      <button
        type="button"
        onClick={handleDisconnect}
        disabled={disconnecting}
        className="px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {disconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disconnect"}
      </button>
    ) : supportsBoth ? (
      <DualConnectionOptions
        providerKey={integration.provider_key}
        displayName={integration.display_name}
        onOAuthConnect={handleConnect}
        onSuccess={onUpdate}
        connecting={connecting}
        size="small"
      />
    ) : supportsPat ? (
      <PatInput
        providerKey={integration.provider_key}
        displayName={integration.display_name}
        onSuccess={onUpdate}
        size="small"
      />
    ) : (
      <button
        type="button"
        onClick={handleConnect}
        disabled={connecting}
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {connecting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Connect"}
      </button>
    )

  const statusElement =
    integration.token_status === TOKEN_STATUS.NEEDS_REAUTH ? (
      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Expired</span>
    ) : integration.is_connected ? (
      <span className="flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Connected
      </span>
    ) : null

  return (
    <div className={getCompactCardStyles(integration.token_status, integration.is_connected)}>
      <div className="p-4">
        <div className="flex items-center gap-3">
          {integration.logo_path ? (
            <img src={integration.logo_path} alt="" className="h-8 w-8 object-contain flex-shrink-0 rounded-lg" />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                {integration.display_name.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-[13px] font-medium text-zinc-900 dark:text-white truncate">
                {integration.display_name}
              </h4>
              {statusElement}
              {integration.visibility_status === VISIBILITY_STATUS.BETA && <EarlyAccessBadge size="small" />}
            </div>
            {providerInfo?.description && (
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">{providerInfo.description}</p>
            )}
          </div>
          {actionButton}
        </div>
        {error && (
          <div className="mt-3">
            <ErrorAlert error={error} size="small" />
          </div>
        )}
        {renderIntegrationUI(integration, "list")}
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
