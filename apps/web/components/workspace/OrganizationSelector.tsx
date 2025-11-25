"use client"

import { Building2, ChevronDown } from "lucide-react"
import { useEffect, useState } from "react"
import { type Organization, useSelectedOrgId, useWorkspaceActions, useHasHydrated } from "@/lib/stores/workspaceStore"

interface OrganizationSelectorProps {
  onOrgChange?: (orgId: string | null) => void
}

export function OrganizationSelector({ onOrgChange }: OrganizationSelectorProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const selectedOrgId = useSelectedOrgId()
  const hasHydrated = useHasHydrated()
  const { setSelectedOrg } = useWorkspaceActions()

  // Fetch organizations on mount
  useEffect(() => {
    fetchOrganizations()
  }, [])

  // Auto-select first org if none selected
  // IMPORTANT: Wait for Zustand hydration to complete before auto-selecting
  // Otherwise we might override the persisted org selection from localStorage
  useEffect(() => {
    if (!hasHydrated) return // Wait for localStorage to be loaded
    if (!loading && organizations.length > 0 && !selectedOrgId) {
      const firstOrg = organizations[0]
      setSelectedOrg(firstOrg.org_id)
      onOrgChange?.(firstOrg.org_id)
    }
  }, [hasHydrated, loading, organizations, selectedOrgId, setSelectedOrg, onOrgChange])

  async function fetchOrganizations() {
    try {
      const response = await fetch("/api/auth/organizations", {
        credentials: "include",
      })

      const data = await response.json()

      if (data.ok && data.organizations) {
        setOrganizations(data.organizations)
      }
    } catch (error) {
      console.error("Failed to fetch organizations:", error)
    } finally {
      setLoading(false)
    }
  }

  function handleSelectOrg(orgId: string) {
    setSelectedOrg(orgId)
    setIsOpen(false)
    onOrgChange?.(orgId)
  }

  const selectedOrg = organizations.find(org => org.org_id === selectedOrgId)

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-black/5 rounded-lg animate-pulse">
        <Building2 className="w-4 h-4 text-black/30" />
        <span className="text-sm text-black/50">Loading...</span>
      </div>
    )
  }

  if (organizations.length === 0) {
    return null
  }

  if (organizations.length === 1) {
    // Don't show selector if only one org
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-black/5 rounded-lg">
        <Building2 className="w-4 h-4 text-black/60" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-black">{selectedOrg?.name}</span>
          <span className="text-xs text-black/50">
            {selectedOrg?.workspace_count || 0} workspace{selectedOrg?.workspace_count !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-black/5 hover:bg-black/10 rounded-lg transition-colors min-w-[200px]"
      >
        <Building2 className="w-4 h-4 text-black/60 flex-shrink-0" />
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-black">{selectedOrg?.name || "Select organization"}</div>
          {selectedOrg && (
            <div className="text-xs text-black/50">
              {selectedOrg.workspace_count || 0} workspace{selectedOrg.workspace_count !== 1 ? "s" : ""}
            </div>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-black/60 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setIsOpen(false)}
            aria-label="Close dropdown"
            tabIndex={-1}
          />
          <div className="absolute top-full left-0 mt-1 w-full bg-white border border-black/10 rounded-lg shadow-lg z-20 max-h-[300px] overflow-y-auto">
            {organizations.map(org => (
              <button
                type="button"
                key={org.org_id}
                onClick={() => handleSelectOrg(org.org_id)}
                className={`w-full px-3 py-2 text-left hover:bg-black/5 transition-colors flex items-center gap-2 ${
                  org.org_id === selectedOrgId ? "bg-black/5" : ""
                }`}
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-black">{org.name}</div>
                  <div className="text-xs text-black/50">
                    {org.workspace_count || 0} workspace{org.workspace_count !== 1 ? "s" : ""} · {org.credits} credits
                  </div>
                </div>
                {org.org_id === selectedOrgId && (
                  <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
