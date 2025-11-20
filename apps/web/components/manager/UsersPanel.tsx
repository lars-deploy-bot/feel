"use client"

import { useState } from "react"

interface UsersPanelProps {
  orgs: any[]
  onSuccess: () => void
  onLoading: (loading: boolean) => void
}

export function UsersPanel({ orgs, onSuccess, onLoading }: UsersPanelProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [orgType, setOrgType] = useState<"new" | "existing">("new")
  const [orgId, setOrgId] = useState("")
  const [orgName, setOrgName] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setIsSubmitting(true)
    onLoading(true)

    try {
      const payload: any = {
        email,
        password,
        displayName: displayName || undefined,
        orgType,
      }

      if (orgType === "new") {
        if (!orgName) {
          setError("Organization name is required")
          setIsSubmitting(false)
          onLoading(false)
          return
        }
        payload.orgName = orgName
      } else {
        if (!orgId) {
          setError("Please select an organization")
          setIsSubmitting(false)
          onLoading(false)
          return
        }
        payload.orgId = orgId
      }

      const response = await fetch("/api/manager/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || "Failed to create user")
        return
      }

      setSuccess(`User ${email} created successfully`)
      setEmail("")
      setPassword("")
      setDisplayName("")
      setOrgType("new")
      setOrgId("")
      setOrgName("")
      onSuccess()

      setTimeout(() => setSuccess(""), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
      onLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-[#1a1a1a]">
      <div className="px-8 py-8">
        <div className="max-w-2xl">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create user account</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Add a new user to your organization</p>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-900 dark:text-red-300">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <p className="text-sm text-emerald-900 dark:text-emerald-300">{success}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-900 dark:text-white mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm text-gray-900 dark:text-white border border-gray-300 dark:border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-white/40 focus:border-gray-400 dark:focus:border-white/40 bg-white dark:bg-[#333]"
                placeholder="user@example.com"
                disabled={isSubmitting}
              />
            </div>

            {/* Display Name */}
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-900 dark:text-white mb-1.5">
                Display name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm text-gray-900 dark:text-white border border-gray-300 dark:border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-white/40 focus:border-gray-400 dark:focus:border-white/40 bg-white dark:bg-[#333]"
                placeholder="John Doe"
                disabled={isSubmitting}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-900 dark:text-white mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm text-gray-900 dark:text-white border border-gray-300 dark:border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-white/40 focus:border-gray-400 dark:focus:border-white/40 bg-white dark:bg-[#333]"
                placeholder="••••••••"
                disabled={isSubmitting}
              />
              <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">
                Password will be hashed and stored securely
              </p>
            </div>

            {/* Organization */}
            <fieldset className="pt-2">
              <legend className="block text-sm font-medium text-gray-900 dark:text-white mb-4">Organization</legend>

              <div className="space-y-4">
                {/* New Organization Option */}
                <button
                  type="button"
                  className="w-full text-left border border-gray-300 dark:border-white/20 rounded-lg p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => {
                    setOrgType("new")
                    setOrgId("")
                  }}
                  disabled={isSubmitting}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="org-type"
                      value="new"
                      checked={orgType === "new"}
                      onChange={() => {
                        setOrgType("new")
                        setOrgId("")
                      }}
                      className="mt-1 w-4 h-4 text-gray-900 dark:text-white border-gray-300 dark:border-white/20 focus:ring-gray-400 dark:focus:ring-white/40"
                      disabled={isSubmitting}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">Create new organization</div>
                      <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Create a new organization for this user
                      </div>
                    </div>
                  </div>

                  {orgType === "new" && (
                    <div className="mt-4 ml-7">
                      <input
                        type="text"
                        required={orgType === "new"}
                        value={orgName}
                        onChange={e => setOrgName(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm text-gray-900 dark:text-white border border-gray-300 dark:border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-white/40 focus:border-gray-400 dark:focus:border-white/40 bg-white dark:bg-[#333]"
                        placeholder="Organization name"
                        disabled={isSubmitting}
                      />
                    </div>
                  )}
                </button>

                {/* Existing Organization Option */}
                <button
                  type="button"
                  className="w-full text-left border border-gray-300 dark:border-white/20 rounded-lg p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => {
                    setOrgType("existing")
                    setOrgName("")
                  }}
                  disabled={isSubmitting}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="org-type"
                      value="existing"
                      checked={orgType === "existing"}
                      onChange={() => {
                        setOrgType("existing")
                        setOrgName("")
                      }}
                      className="mt-1 w-4 h-4 text-gray-900 dark:text-white border-gray-300 dark:border-white/20 focus:ring-gray-400 dark:focus:ring-white/40"
                      disabled={isSubmitting}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">Use existing organization</div>
                      <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Assign this user to an existing organization
                      </div>
                    </div>
                  </div>

                  {orgType === "existing" && (
                    <div className="mt-4 ml-7">
                      <select
                        required={orgType === "existing"}
                        value={orgId}
                        onChange={e => setOrgId(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm text-gray-900 dark:text-white border border-gray-300 dark:border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-white/40 focus:border-gray-400 dark:focus:border-white/40 bg-white dark:bg-[#333]"
                        disabled={isSubmitting}
                      >
                        <option value="">Select organization...</option>
                        {orgs.map(org => (
                          <option key={org.org_id} value={org.org_id}>
                            {org.name}
                          </option>
                        ))}
                      </select>
                      {orgs.length === 0 && (
                        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                          No organizations available. Create a new one instead.
                        </p>
                      )}
                    </div>
                  )}
                </button>
              </div>
            </fieldset>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => {
                  setEmail("")
                  setPassword("")
                  setDisplayName("")
                  setOrgType("new")
                  setOrgId("")
                  setOrgName("")
                  setError("")
                }}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#333] border border-gray-300 dark:border-white/20 rounded-lg hover:bg-gray-50 dark:hover:bg-[#444] focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-white/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-white/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Creating..." : "Create account"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
