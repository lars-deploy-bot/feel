"use client"

import { useEffect, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { DeleteModal } from "@/components/modals/DeleteModal"
import { Button } from "@/components/ui/primitives/Button"

interface DomainConfig {
  tenantId?: string
  port?: number
  orphaned?: boolean
}

interface DomainStatus {
  domain: string
  portListening: boolean
  httpAccessible: boolean
  httpsAccessible: boolean
  systemdServiceExists: boolean
  systemdServiceRunning: boolean
  caddyConfigured: boolean
  siteDirectoryExists: boolean
  lastChecked: number
}

type DomainPasswords = Record<string, DomainConfig>

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

  // Tab state
  const [activeTab, setActiveTab] = useState<"domains" | "settings">("domains")

  // Settings actions state
  const [reloadingCaddy, setReloadingCaddy] = useState(false)
  const [restartingBridge, setRestartingBridge] = useState(false)

  // Login form state
  const [showLogin, setShowLogin] = useState(false)
  const [pass, setPass] = useState("")
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState("")

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
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setSelectedDomain(null)
    setNewPassword("")
  }

  const updatePassword = async () => {
    if (!selectedDomain || !newPassword.trim()) {
      toast.error("Password cannot be empty")
      return
    }

    setSaving(selectedDomain)
    try {
      const response = await fetch("/api/manager", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ domain: selectedDomain, password: newPassword }),
      })

      if (response.ok) {
        toast.success("Password updated successfully")
        closeDialog()
      } else {
        toast.error("Failed to update password")
      }
    } catch (error) {
      console.error("Failed to update password:", error)
      toast.error("Failed to update password")
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
            <h1 className="text-6xl font-thin mb-8 text-white">•</h1>
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
                className="w-full bg-transparent border-0 border-b border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white pb-3 text-lg font-thin"
              />

              {loginError && <p className="text-white/60 text-sm">{loginError}</p>}

              <Button
                type="submit"
                fullWidth
                loading={loginLoading}
                disabled={!pass.trim()}
                className="!bg-white !text-black hover:!bg-white/90 !border-0 !font-thin !text-lg !py-4"
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
                <div className="flex justify-between items-center">
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
                              </>
                            )}
                          </div>
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
                        <button
                          type="button"
                          onClick={() => openPasswordDialog(domain)}
                          disabled={config.orphaned}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={config.orphaned ? "Cannot set password for orphaned domain" : ""}
                        >
                          Set Password
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
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Set Password</h2>
            <p className="text-sm text-gray-600 mb-4">
              Enter a new password for <span className="font-medium">{selectedDomain}</span>
            </p>

            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && newPassword.trim()) {
                  updatePassword()
                }
                if (e.key === "Escape") {
                  closeDialog()
                }
              }}
              placeholder="New password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-6"
            />

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
                onClick={updatePassword}
                disabled={saving === selectedDomain || !newPassword.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving === selectedDomain ? "Saving..." : "Save Password"}
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
    </div>
  )
}
