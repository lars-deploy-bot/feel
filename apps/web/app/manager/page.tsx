"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/primitives/Button"
import toast, { Toaster } from 'react-hot-toast'

interface DomainConfig {
  password: string
  port: number
}

type DomainPasswords = Record<string, DomainConfig>

export default function ManagerPage() {
  const [domains, setDomains] = useState<DomainPasswords>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  // Login form state
  const [showLogin, setShowLogin] = useState(false)
  const [pass, setPass] = useState("")
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState("")

  useEffect(() => {
    checkAuthentication()
  }, [])

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
      }
    } catch (error) {
      console.error("Failed to fetch domains:", error)
    } finally {
      setLoading(false)
    }
  }

  const updatePassword = async (domain: string, newPassword: string) => {
    setSaving(domain)
    try {
      const response = await fetch("/api/manager", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ domain, password: newPassword }),
      })

      if (response.ok) {
        setDomains(prev => ({
          ...prev,
          [domain]: { ...prev[domain], password: newPassword }
        }))
        toast.success('Password updated successfully')
      } else {
        toast.error('Failed to update password')
      }
    } catch (error) {
      console.error("Failed to update password:", error)
      toast.error('Failed to update password')
    } finally {
      setSaving(null)
    }
  }

  const handlePasswordChange = (domain: string, newPassword: string) => {
    setDomains(prev => ({
      ...prev,
      [domain]: { ...prev[domain], password: newPassword }
    }))
  }

  const handleSave = (domain: string) => {
    updatePassword(domain, domains[domain].password)
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
        toast.success('Domain deleted successfully')
      } else {
        toast.error('Failed to delete domain')
      }
    } catch (error) {
      console.error("Failed to delete domain:", error)
      toast.error('Failed to delete domain')
    } finally {
      setDeleting(null)
    }
  }

  const handleDelete = (domain: string) => {
    if (confirm(`Are you sure you want to delete ${domain}? This action cannot be undone.`)) {
      deleteDomain(domain)
    }
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
        toast.error('Failed to logout')
      }
    } catch (error) {
      console.error("Logout failed:", error)
      toast.error('Failed to logout')
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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Domain Manager</h1>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Domain Passwords</h2>
            <p className="text-sm text-gray-600 mt-1">Manage passwords for each domain</p>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              {Object.entries(domains).map(([domain, config]) => (
                <div key={domain} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{domain}</div>
                    <div className="text-sm text-gray-500">Port: {config.port}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={config.password}
                      onChange={(e) => handlePasswordChange(domain, e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Password"
                    />

                    <button
                      onClick={() => handleSave(domain)}
                      disabled={saving === domain}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving === domain ? "Saving..." : "Save"}
                    </button>

                    <button
                      onClick={() => handleDelete(domain)}
                      disabled={deleting === domain}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting === domain ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {Object.keys(domains).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No domains found
              </div>
            )}
          </div>
        </div>
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            style: {
              background: '#10B981',
            },
          },
          error: {
            style: {
              background: '#EF4444',
            },
          },
        }}
      />
    </div>
  )
}