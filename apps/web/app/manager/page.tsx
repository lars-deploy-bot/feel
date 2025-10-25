"use client"

import { useState, useEffect } from "react"

interface DomainConfig {
  password: string
  port: number
}

type DomainPasswords = Record<string, DomainConfig>

export default function ManagerPage() {
  const [domains, setDomains] = useState<DomainPasswords>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    fetchDomains()
  }, [])

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
      } else {
        alert("Failed to update password")
      }
    } catch (error) {
      console.error("Failed to update password:", error)
      alert("Failed to update password")
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Domain Manager</h1>

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
    </div>
  )
}