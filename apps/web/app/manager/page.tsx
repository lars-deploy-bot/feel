"use client"

import { useCallback, useEffect, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { DeleteModal } from "@/components/modals/DeleteModal"
import { Button } from "@/components/ui/primitives/Button"
import type { DomainConfigClient, DomainStatus } from "@/types/domain"
import type { FeedbackEntry } from "@/types/feedback"

type DomainPasswords = Record<string, DomainConfigClient>

export default function ManagerPage() {
  const [domains, setDomains] = useState<DomainPasswords>({})
  const [statuses, setStatuses] = useState<Record<string, DomainStatus>>({})
  const [loading, setLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newCredits, setNewCredits] = useState("")

  // Tab state
  const [activeTab, setActiveTab] = useState<"domains" | "feedback" | "settings">("domains")

  // Feedback state
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([])
  const [feedbackLoading, setFeedbackLoading] = useState(false)

  // Settings actions state
  const [reloadingCaddy, setReloadingCaddy] = useState(false)
  const [restartingBridge, setRestartingBridge] = useState(false)
  const [backingUp, setBackingUp] = useState(false)

  // Login form state
  const [showLogin, setShowLogin] = useState(false)
  const [pass, setPass] = useState("")
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState("")

  // Permissions check state
  const [permissionsModal, setPermissionsModal] = useState<string | null>(null)
  const [permissionsData, setPermissionsData] = useState<any>(null)
  const [checkingPermissions, setCheckingPermissions] = useState(false)
  const [fixingPermissions, setFixingPermissions] = useState(false)

  // Expandable detail view state
  const [_expandedDomain, _setExpandedDomain] = useState<string | null>(null)

  const fetchFeedback = useCallback(async () => {
    setFeedbackLoading(true)
    try {
      const response = await fetch("/api/manager/feedback")
      const data = await response.json()
      if (data.ok) {
        setFeedback(data.feedback)
      } else {
        toast.error("Failed to fetch feedback")
      }
    } catch (error) {
      console.error("Failed to fetch feedback:", error)
      toast.error("Failed to fetch feedback")
    } finally {
      setFeedbackLoading(false)
    }
  }, [])

  useEffect(() => {
    checkAuthentication()
  }, [])

  useEffect(() => {
    if (!authenticated || Object.keys(domains).length === 0) return

    const interval = setInterval(() => {
      fetchStatuses()
    }, 30000)

    return () => clearInterval(interval)
  }, [authenticated, domains])

  useEffect(() => {
    if (activeTab === "feedback" && authenticated) {
      fetchFeedback()
    }
  }, [activeTab, authenticated, fetchFeedback])

  const checkAuthentication = async () => {
    try {
      const response = await fetch("/api/manager")
      if (response.ok) {
        setAuthenticated(true)
        setShowLogin(false)
        fetchDomains()
      } else {
        setAuthenticated(false)
        setShowLogin(true)
        setLoading(false)
      }
    } catch (error) {
      console.error("Authentication check failed:", error)
      setAuthenticated(false)
      setShowLogin(true)
      setLoading(false)
    }
  }

  const fetchDomains = async () => {
    try {
      const response = await fetch("/api/manager")
      const data = await response.json()
      if (data.ok) {
        setDomains(data.domains)
        fetchStatuses()
      }
    } catch (error) {
      console.error("Failed to fetch domains:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStatuses = async () => {
    setLoadingStatus(true)
    try {
      const response = await fetch("/api/manager/status")
      const data = await response.json()
      if (data.ok) {
        const statusMap = data.statuses.reduce((acc: Record<string, DomainStatus>, status: DomainStatus) => {
          acc[status.domain] = status
          return acc
        }, {})
        setStatuses(statusMap)
      }
    } catch (error) {
      console.error("Failed to fetch statuses:", error)
    } finally {
      setLoadingStatus(false)
    }
  }

  const openPasswordDialog = (domain: string) => {
    setSelectedDomain(domain)
    setNewPassword("")
    setNewEmail(domains[domain]?.email || "")
    setNewCredits(String(domains[domain]?.credits || 0))
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setSelectedDomain(null)
    setNewPassword("")
    setNewEmail("")
    setNewCredits("")
  }

  const updateDomainSettings = async () => {
    if (!selectedDomain) {
      return
    }

    const creditsNum = newCredits ? parseFloat(newCredits) : undefined
    const emailChanged = newEmail !== (domains[selectedDomain]?.email || "")
    const creditsChanged = creditsNum !== undefined && creditsNum !== domains[selectedDomain]?.credits

    // Validate: at least one field must be changed
    if (!newPassword.trim() && !emailChanged && !creditsChanged) {
      toast.error("No changes to save")
      return
    }

    // Validate credits
    if (creditsNum !== undefined && (creditsNum < 0 || Number.isNaN(creditsNum))) {
      toast.error("Credits must be a non-negative number")
      return
    }

    setSaving(selectedDomain)
    try {
      const payload: { domain: string; password?: string; email?: string; credits?: number } = {
        domain: selectedDomain,
      }

      if (newPassword.trim()) {
        payload.password = newPassword
      }

      if (emailChanged) {
        payload.email = newEmail
      }

      if (creditsChanged) {
        payload.credits = creditsNum
      }

      const response = await fetch("/api/manager", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        // Update local state
        setDomains(prev => ({
          ...prev,
          [selectedDomain]: {
            ...prev[selectedDomain],
            email: newEmail || undefined,
            ...(creditsChanged && { credits: creditsNum }),
            ...(creditsChanged && { tokens: creditsNum ? creditsNum * 100 : 0 }),
          },
        }))

        toast.success("Updated successfully")
        closeDialog()
      } else {
        const error = await response.json()
        toast.error(error.message || "Failed to update")
      }
    } catch (error) {
      console.error("Failed to update:", error)
      toast.error("Failed to update")
    } finally {
      setSaving(null)
    }
  }

  const deleteDomain = async (domain: string) => {
    setDeleting(domain)
    try {
      const response = await fetch("/api/manager", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ domain }),
      })

      if (response.ok) {
        setDomains(prev => {
          const newDomains = { ...prev }
          delete newDomains[domain]
          return newDomains
        })
        setStatuses(prev => {
          const newStatuses = { ...prev }
          delete newStatuses[domain]
          return newStatuses
        })
        toast.success("Domain deleted successfully")
      } else {
        toast.error("Failed to delete domain")
      }
    } catch (error) {
      console.error("Failed to delete domain:", error)
      toast.error("Failed to delete domain")
    } finally {
      setDeleting(null)
    }
  }

  const handleDelete = (domain: string) => {
    setDeleteConfirm(domain)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return
    await deleteDomain(deleteConfirm)
    setDeleteConfirm(null)
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      })

      if (response.ok) {
        // Reset state to show login form again
        setAuthenticated(false)
        setShowLogin(true)
        setDomains({})
        setPass("")
        setLoginError("")
      } else {
        toast.error("Failed to logout")
      }
    } catch (error) {
      console.error("Logout failed:", error)
      toast.error("Failed to logout")
    } finally {
      setLoggingOut(false)
    }
  }

  const handleManagerLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError("")

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: pass, workspace: "manager" }),
      })

      if (response.ok) {
        setAuthenticated(true)
        setShowLogin(false)
        fetchDomains()
      } else {
        setLoginError("Invalid manager passcode")
      }
    } catch (error) {
      console.error("Manager login failed:", error)
      setLoginError("Connection failed")
    } finally {
      setLoginLoading(false)
    }
  }

  if (!authenticated) {
    if (loading) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-xl text-white">Checking authentication...</div>
        </div>
      )
    }

    if (showLogin) {
      return (
        <main className="min-h-screen bg-black flex items-center justify-center">
          <div className="w-80">
            <h1 className="text-6xl font-normal mb-8 text-white">•</h1>
            <p className="text-white/60 text-center mb-8">Manager Access</p>

            <form onSubmit={handleManagerLogin} className="space-y-8" autoComplete="off">
              <input
                type="password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="manager passcode"
                disabled={loginLoading}
                autoComplete="new-password"
                autoSave="off"
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
                className="w-full bg-transparent border-0 border-b border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white pb-3 text-lg font-normal"
              />

              {loginError && <p className="text-white/60 text-sm">{loginError}</p>}

              <Button
                type="submit"
                fullWidth
                loading={loginLoading}
                disabled={!pass.trim()}
                className="!bg-white !text-black hover:!bg-white/90 !border-0 !font-normal !text-lg !py-4"
              >
                enter manager
              </Button>
            </form>
          </div>
        </main>
      )
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading domains...</div>
      </div>
    )
  }

  const getStatusColor = (domain: string) => {
    const status = statuses[domain]
    if (!status) return "bg-gray-300 animate-pulse"
    if (status.httpsAccessible) return "bg-green-500"
    if (status.httpAccessible) return "bg-yellow-500"
    if (status.portListening) return "bg-orange-500"
    return "bg-red-500"
  }

  const getStatusText = (domain: string) => {
    const status = statuses[domain]
    if (!status) return "Checking"
    if (status.httpsAccessible) return "Online"
    if (status.httpAccessible) return "HTTP only"
    if (status.portListening) return "Port open"
    return "Offline"
  }

  const getStatusDetails = (domain: string) => {
    const status = statuses[domain]
    if (!status) return "Status unknown"
    const parts = []
    if (status.httpsAccessible) parts.push("HTTPS ✓")
    else if (status.httpAccessible) parts.push("HTTP ✓")
    if (status.portListening) parts.push("Port listening")
    return parts.length > 0 ? parts.join(" • ") : "Not accessible"
  }

  const getInfrastructureChecks = (domain: string) => {
    const status = statuses[domain]
    if (!status) return null

    return [
      {
        label: "DNS",
        pass: status.dnsPointsToServer,
        detail: status.dnsPointsToServer
          ? status.dnsIsProxied
            ? `verified via ${status.dnsVerificationMethod || "https"} (proxied)`
            : `verified via ${status.dnsVerificationMethod || "direct"}`
          : status.dnsResolvedIp
            ? `points to ${status.dnsResolvedIp} (verification failed)`
            : "not resolved",
      },
      {
        label: "Port",
        pass: !status.vitePortMismatch,
        detail: status.vitePortMismatch
          ? status.hasSystemdPortOverride
            ? `systemd override + config: ${status.viteActualPort}, expected: ${status.viteExpectedPort}`
            : `config: ${status.viteActualPort}, expected: ${status.viteExpectedPort}`
          : status.viteActualPort
            ? `${status.viteActualPort}`
            : "not configured",
      },
      {
        label: "Systemd",
        pass: status.systemdServiceExists && status.systemdServiceRunning,
        detail: status.systemdServiceExists ? (status.systemdServiceRunning ? "running" : "stopped") : "missing",
      },
      {
        label: "Caddy",
        pass: status.caddyConfigured,
        detail: status.caddyConfigured ? "configured" : "not configured",
      },
      { label: "Files", pass: status.siteDirectoryExists, detail: status.siteDirectoryExists ? "exists" : "missing" },
    ]
  }

  const formatCreatedDate = (isoDate: string | null): string => {
    if (!isoDate) return "Unknown"
    const date = new Date(isoDate)
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
  }

  const handleReloadCaddy = async () => {
    setReloadingCaddy(true)
    try {
      const response = await fetch("/api/manager/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reload_caddy" }),
      })

      if (response.ok) {
        toast.success("Caddy reloaded successfully")
      } else {
        const data = await response.json()
        toast.error(data.error || "Failed to reload Caddy")
      }
    } catch (error) {
      console.error("Failed to reload Caddy:", error)
      toast.error("Failed to reload Caddy")
    } finally {
      setReloadingCaddy(false)
    }
  }

  const handleRestartBridge = async () => {
    if (!confirm("This will restart the Claude Bridge server. Continue?")) return

    setRestartingBridge(true)
    try {
      const response = await fetch("/api/manager/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restart_bridge" }),
      })

      if (response.ok) {
        toast.success("Bridge restart initiated (page will reload in 5s)")
        setTimeout(() => window.location.reload(), 5000)
      } else {
        const data = await response.json()
        toast.error(data.error || "Failed to restart bridge")
        setRestartingBridge(false)
      }
    } catch (error) {
      console.error("Failed to restart bridge:", error)
      toast.error("Failed to restart bridge")
      setRestartingBridge(false)
    }
  }

  const handleBackupWebsites = async () => {
    setBackingUp(true)
    try {
      const response = await fetch("/api/manager/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "backup_websites" }),
      })

      if (response.ok) {
        toast.success("Websites backed up successfully to GitHub")
      } else {
        let errorMessage = "Failed to backup websites"
        try {
          const data = await response.json()
          errorMessage = data.error || errorMessage
        } catch {
          // Response body is empty or invalid JSON
        }
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error("Failed to backup websites:", error)
      toast.error("Failed to backup websites")
    } finally {
      setBackingUp(false)
    }
  }

  const handleCheckPermissions = async (domain: string) => {
    setCheckingPermissions(true)
    setPermissionsModal(domain)
    try {
      const response = await fetch(`/api/manager/permissions?domain=${encodeURIComponent(domain)}`)
      const data = await response.json()
      if (data.ok) {
        setPermissionsData(data.result)
      } else {
        toast.error(data.error || "Failed to check permissions")
        setPermissionsModal(null)
      }
    } catch (error) {
      console.error("Failed to check permissions:", error)
      toast.error("Failed to check permissions")
      setPermissionsModal(null)
    } finally {
      setCheckingPermissions(false)
    }
  }

  const handleFixPermissions = async (domain: string) => {
    setFixingPermissions(true)
    try {
      const response = await fetch("/api/manager/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, action: "fix" }),
      })
      const data = await response.json()
      if (data.ok) {
        toast.success("Permissions fixed successfully")
        setPermissionsData(data.result)
      } else {
        toast.error(data.error || "Failed to fix permissions")
      }
    } catch (error) {
      console.error("Failed to fix permissions:", error)
      toast.error("Failed to fix permissions")
    } finally {
      setFixingPermissions(false)
    }
  }

  const closePermissionsModal = () => {
    setPermissionsModal(null)
    setPermissionsData(null)
  }

  const handleFixPort = async (domain: string) => {
    try {
      const response = await fetch("/api/manager/vite-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, action: "fix-port" }),
      })
      const data = await response.json()
      if (data.ok) {
        toast.success("Port fixed and service restarted")
        // Refresh statuses to show updated port
        fetchStatuses()
      } else {
        toast.error(data.error || "Failed to fix port")
      }
    } catch (error) {
      console.error("Failed to fix port:", error)
      toast.error("Failed to fix port")
    }
  }

  const getSummaryStats = () => {
    const domainList = Object.keys(statuses)
    const total = domainList.length
    const online = domainList.filter(d => statuses[d]?.httpsAccessible).length
    const httpOnly = domainList.filter(d => statuses[d]?.httpAccessible && !statuses[d]?.httpsAccessible).length
    const offline = domainList.filter(d => !statuses[d]?.httpAccessible && !statuses[d]?.httpsAccessible).length
    const withIssues = domainList.filter(d => {
      const s = statuses[d]
      return s && (!s.dnsPointsToServer || s.vitePortMismatch || !s.systemdServiceRunning || !s.caddyConfigured)
    }).length

    return { total, online, httpOnly, offline, withIssues }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Domain Manager</h1>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={fetchStatuses}
              disabled={loadingStatus}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingStatus ? "Checking..." : "Refresh Status"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <div className="flex gap-4 px-6">
              <button
                type="button"
                onClick={() => setActiveTab("domains")}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "domains"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Domain Passwords
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("feedback")}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "feedback"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Feedback
                {feedback.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">
                    {feedback.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("settings")}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "settings"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Settings
              </button>
            </div>
          </div>

          {activeTab === "domains" && (
            <>
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">Domain Passwords</h2>
                    <p className="text-sm text-gray-600 mt-1">Manage passwords for each domain</p>
                  </div>
                  {loadingStatus && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      Checking status...
                    </div>
                  )}
                </div>

                {Object.keys(statuses).length > 0 &&
                  (() => {
                    const stats = getSummaryStats()
                    return (
                      <div className="grid grid-cols-5 gap-3">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                          <div className="text-xs text-gray-600">Total Sites</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3">
                          <div className="text-2xl font-bold text-green-700">{stats.online}</div>
                          <div className="text-xs text-green-600">Online (HTTPS)</div>
                        </div>
                        <div className="bg-yellow-50 rounded-lg p-3">
                          <div className="text-2xl font-bold text-yellow-700">{stats.httpOnly}</div>
                          <div className="text-xs text-yellow-600">HTTP Only</div>
                        </div>
                        <div className="bg-red-50 rounded-lg p-3">
                          <div className="text-2xl font-bold text-red-700">{stats.offline}</div>
                          <div className="text-xs text-red-600">Offline</div>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-3">
                          <div className="text-2xl font-bold text-orange-700">{stats.withIssues}</div>
                          <div className="text-xs text-orange-600">With Issues</div>
                        </div>
                      </div>
                    )
                  })()}
              </div>

              <div className="p-6">
                <div className="space-y-4">
                  {Object.entries(domains).map(([domain, config]) => (
                    <div key={domain} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex flex-col items-center gap-1 min-w-[80px]">
                          <div
                            className={`w-3 h-3 rounded-full ${getStatusColor(domain)}`}
                            title={getStatusDetails(domain)}
                          />
                          <div className="text-xs text-gray-500 font-medium">{getStatusText(domain)}</div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-gray-900">{domain}</div>
                            {config.orphaned && (
                              <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700 font-medium">
                                ⚠ ORPHANED
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{getStatusDetails(domain)}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {config.orphaned ? (
                              <span className="text-yellow-600">Infrastructure exists but not in registry</span>
                            ) : (
                              <>
                                Port: {config.port}
                                {config.tenantId && ` • Tenant: ${config.tenantId}`}
                                {config.email && ` • ${config.email}`}
                                {statuses[domain]?.createdAt &&
                                  ` • Created: ${formatCreatedDate(statuses[domain].createdAt)}`}
                              </>
                            )}
                          </div>
                          {!config.orphaned && config.credits !== undefined && (
                            <div className="text-xs text-blue-600 font-medium mt-1">
                              Credits: {config.credits.toFixed(2)}
                            </div>
                          )}
                          {(() => {
                            const checks = getInfrastructureChecks(domain)
                            if (!checks) return null
                            return (
                              <div className="flex gap-2 mt-2">
                                {checks.map((check, i) => (
                                  <div
                                    key={i}
                                    className={`text-xs px-2 py-1 rounded ${
                                      check.pass ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                    }`}
                                    title={check.detail}
                                  >
                                    {check.pass ? "✓" : "✗"} {check.label}
                                  </div>
                                ))}
                              </div>
                            )
                          })()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {statuses[domain]?.vitePortMismatch && (
                          <button
                            type="button"
                            onClick={() => handleFixPort(domain)}
                            className="px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            title="Fix port mismatch in vite config"
                          >
                            ⚙️ Fix Port
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleCheckPermissions(domain)}
                          className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          title="Check file permissions"
                        >
                          🔒
                        </button>

                        <button
                          type="button"
                          onClick={() => openPasswordDialog(domain)}
                          disabled={config.orphaned}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={config.orphaned ? "Cannot edit orphaned domain" : "Edit domain settings"}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(domain)}
                          disabled={deleting === domain}
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deleting === domain ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}

                  {Object.keys(domains).length === 0 && (
                    <div className="text-center py-8 text-gray-500">No domains found</div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === "feedback" && (
            <>
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">User Feedback</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      View feedback submitted from all workspaces ({feedback.length} total)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchFeedback}
                    disabled={feedbackLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {feedbackLoading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
              </div>

              <div className="p-6">
                {feedbackLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading feedback...</div>
                ) : feedback.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No feedback submitted yet</div>
                ) : (
                  <div className="space-y-4">
                    {feedback.map(entry => (
                      <div
                        key={entry.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{entry.workspace}</span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-500">
                              {new Date(entry.timestamp).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            {entry.conversationId && (
                              <span
                                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded"
                                title={entry.conversationId}
                              >
                                Has conversation
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{entry.feedback}</div>

                        {entry.userAgent && (
                          <div className="text-xs text-gray-400 font-mono truncate" title={entry.userAgent}>
                            {entry.userAgent}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "settings" && (
            <>
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">System Settings</h2>
                <p className="text-sm text-gray-600 mt-1">Manage system services and configuration</p>
              </div>

              <div className="p-6">
                <div className="space-y-6">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-base font-semibold text-gray-900 mb-2">Caddy Web Server</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Reload Caddy configuration to apply changes from the Caddyfile
                    </p>
                    <button
                      type="button"
                      onClick={handleReloadCaddy}
                      disabled={reloadingCaddy}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {reloadingCaddy ? "Reloading..." : "Reload Caddy"}
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-base font-semibold text-gray-900 mb-2">Claude Bridge</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Restart the Claude Bridge server (this will disconnect all active sessions)
                    </p>
                    <button
                      type="button"
                      onClick={handleRestartBridge}
                      disabled={restartingBridge}
                      className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {restartingBridge ? "Restarting..." : "Restart Bridge"}
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-base font-semibold text-gray-900 mb-2">Domain Status</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Check the status of all domains (HTTP, HTTPS, systemd, Caddy, files)
                    </p>
                    <button
                      type="button"
                      onClick={fetchStatuses}
                      disabled={loadingStatus}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingStatus ? "Checking..." : "Refresh All Statuses"}
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-base font-semibold text-gray-900 mb-2">Backup Websites</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Push all website changes from /srv/webalive to GitHub repository (eenlars/all_websites)
                    </p>
                    <button
                      type="button"
                      onClick={handleBackupWebsites}
                      disabled={backingUp}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {backingUp ? "Backing up..." : "Backup to GitHub"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#363636",
            color: "#fff",
          },
          success: {
            style: {
              background: "#10B981",
            },
          },
          error: {
            style: {
              background: "#EF4444",
            },
          },
        }}
      />

      {dialogOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          onClick={closeDialog}
          onKeyDown={e => {
            if (e.key === "Escape") closeDialog()
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"
            role="document"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Edit Domain</h2>
            <p className="text-sm text-gray-600 mb-4">
              Update settings for <span className="font-medium">{selectedDomain}</span>
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label htmlFor="credits-input" className="block text-sm font-medium text-gray-700 mb-1">
                  Credits
                </label>
                <input
                  id="credits-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newCredits}
                  onChange={e => setNewCredits(e.target.value)}
                  placeholder="200"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Current: {domains[selectedDomain || ""]?.credits?.toFixed(2) || "0.00"} credits
                </p>
              </div>

              <div>
                <label htmlFor="email-input" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  id="email-input"
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="owner@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="password-input" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password (optional)
                </label>
                <input
                  id="password-input"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      updateDomainSettings()
                    }
                    if (e.key === "Escape") {
                      closeDialog()
                    }
                  }}
                  placeholder="Leave blank to keep current"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDialog}
                disabled={saving === selectedDomain}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={updateDomainSettings}
                disabled={
                  saving === selectedDomain ||
                  (!newPassword.trim() &&
                    newEmail === (domains[selectedDomain || ""]?.email || "") &&
                    parseFloat(newCredits) === domains[selectedDomain || ""]?.credits)
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving === selectedDomain ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <DeleteModal
          title={`Delete ${deleteConfirm}?`}
          message={
            <div className="space-y-2">
              <p>This will permanently remove:</p>
              <ul className="text-left inline-block">
                <li>• Systemd service</li>
                <li>• Site directory and files</li>
                <li>• Caddy configuration</li>
                {!domains[deleteConfirm]?.orphaned && <li>• Password registry entry</li>}
              </ul>
              <p className="font-medium text-red-600 mt-4">This action cannot be undone.</p>
            </div>
          }
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {permissionsModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          onClick={closePermissionsModal}
          onKeyDown={e => {
            if (e.key === "Escape") closePermissionsModal()
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto"
            role="document"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">File Permissions</h2>
                <p className="text-sm text-gray-600 mt-1">{permissionsModal}</p>
              </div>
              <button type="button" onClick={closePermissionsModal} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            {checkingPermissions ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-gray-600">Checking permissions...</p>
              </div>
            ) : permissionsData ? (
              <div className="space-y-4">
                {permissionsData.error ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 font-medium">{permissionsData.error}</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Expected Owner</p>
                        <p className="text-lg font-semibold text-gray-900">{permissionsData.expectedOwner}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Total Files</p>
                        <p className="text-lg font-semibold text-gray-900">{permissionsData.totalFiles}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div
                        className={`border rounded-lg p-4 ${
                          permissionsData.rootOwnedFiles > 0
                            ? "border-red-300 bg-red-50"
                            : "border-green-300 bg-green-50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-gray-900">Root-Owned Files</p>
                          <span
                            className={`text-2xl font-bold ${
                              permissionsData.rootOwnedFiles > 0 ? "text-red-600" : "text-green-600"
                            }`}
                          >
                            {permissionsData.rootOwnedFiles}
                          </span>
                        </div>
                        {permissionsData.rootOwnedFiles > 0 && permissionsData.rootOwnedFilesList.length > 0 && (
                          <div className="mt-3 space-y-1">
                            <p className="text-xs text-gray-600 font-medium mb-1">Sample files:</p>
                            {permissionsData.rootOwnedFilesList.map((file: string, i: number) => (
                              <p key={i} className="text-xs font-mono text-gray-700 truncate" title={file}>
                                {file}
                              </p>
                            ))}
                            {permissionsData.rootOwnedFiles > 10 && (
                              <p className="text-xs text-gray-500 italic">
                                ... and {permissionsData.rootOwnedFiles - 10} more
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div
                        className={`border rounded-lg p-4 ${
                          permissionsData.wrongOwnerFiles > 0
                            ? "border-orange-300 bg-orange-50"
                            : "border-green-300 bg-green-50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-gray-900">Wrong Owner Files</p>
                          <span
                            className={`text-2xl font-bold ${
                              permissionsData.wrongOwnerFiles > 0 ? "text-orange-600" : "text-green-600"
                            }`}
                          >
                            {permissionsData.wrongOwnerFiles}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">Files not owned by {permissionsData.expectedOwner}</p>
                        {permissionsData.wrongOwnerFiles > 0 && permissionsData.wrongOwnerFilesList.length > 0 && (
                          <div className="mt-3 space-y-1">
                            <p className="text-xs text-gray-600 font-medium mb-1">Sample files:</p>
                            {permissionsData.wrongOwnerFilesList.map((file: string, i: number) => (
                              <p key={i} className="text-xs font-mono text-gray-700 truncate" title={file}>
                                {file}
                              </p>
                            ))}
                            {permissionsData.wrongOwnerFiles > 10 && (
                              <p className="text-xs text-gray-500 italic">
                                ... and {permissionsData.wrongOwnerFiles - 10} more
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {permissionsData.wrongOwnerFiles > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-sm text-yellow-800">
                          ⚠️ Files with incorrect ownership detected. Click "Fix Permissions" to update all files to the
                          correct owner.
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t">
                      <button
                        type="button"
                        onClick={closePermissionsModal}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                      >
                        Close
                      </button>
                      {permissionsData.wrongOwnerFiles > 0 && (
                        <button
                          type="button"
                          onClick={() => handleFixPermissions(permissionsModal)}
                          disabled={fixingPermissions}
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {fixingPermissions ? "Fixing..." : "Fix Permissions"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCheckPermissions(permissionsModal)}
                        disabled={checkingPermissions}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {checkingPermissions ? "Checking..." : "Recheck"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
