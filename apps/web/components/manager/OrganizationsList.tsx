"use client"

import { useState } from "react"

interface Organization {
  org_id: string
  name: string
  credits: number
  member_count: number
  domain_count: number
  created_at: string
  domains: any[]
  members: any[]
}

interface OrganizationsListProps {
  orgs: Organization[]
  loading: boolean
  deleting: string | null
  transferring: string | null
  removing: string | null
  onRefresh: () => void
  onEditCredits: (orgId: string, credits: number) => void
  onDelete: (orgId: string) => void
  onAddMember: (orgId: string) => void
  onTransferOwnership: (orgId: string, userId: string, userName: string) => void
  onRemoveMember: (orgId: string, userId: string) => void
}

export function OrganizationsList({
  orgs,
  loading,
  deleting,
  transferring,
  removing,
  onRefresh,
  onEditCredits,
  onDelete,
  onAddMember,
  onTransferOwnership,
  onRemoveMember,
}: OrganizationsListProps) {
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null)

  return (
    <>
      <div className="px-6 py-5 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">
            {orgs.length} organization{orgs.length !== 1 ? "s" : ""}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="text-xs px-2.5 py-1.5 text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div>
        {loading ? (
          <div className="text-center py-12 px-6">
            <p className="text-sm text-slate-600">Loading organizations...</p>
          </div>
        ) : orgs.length === 0 ? (
          <div className="text-center py-12 px-6">
            <p className="text-sm text-slate-600">No organizations found</p>
            <p className="text-sm text-slate-500 mt-1">Organizations will appear here when created</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {orgs.map(org => (
              <div key={org.org_id} className="hover:bg-slate-50">
                {/* Organization Header */}
                <div className="px-6 py-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <button
                        type="button"
                        onClick={() => setExpandedOrg(expandedOrg === org.org_id ? null : org.org_id)}
                        className="text-left hover:text-indigo-600 transition-colors"
                      >
                        <h3 className="text-base font-semibold text-slate-900">{org.name}</h3>
                      </button>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                        <span>
                          Credits: <span className="font-medium text-slate-900">{org.credits.toFixed(2)}</span>
                        </span>
                        <span>Members: {org.member_count}</span>
                        <span>Projects: {org.domain_count}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Created {new Date(org.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEditCredits(org.org_id, org.credits)}
                        className="text-xs px-2.5 py-1.5 text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors"
                      >
                        Edit credits
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(org.org_id)}
                        disabled={deleting === org.org_id}
                        className="text-xs px-2.5 py-1.5 text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {deleting === org.org_id ? "Deleting..." : "Delete"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedOrg(expandedOrg === org.org_id ? null : org.org_id)}
                        className="text-xs px-2.5 py-1.5 text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
                      >
                        {expandedOrg === org.org_id ? "Collapse" : "Expand"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedOrg === org.org_id && (
                  <div className="px-6 py-5 bg-white border-t border-slate-200 space-y-6">
                    {/* Projects */}
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 mb-3">Projects</h4>
                      {org.domains.length === 0 ? (
                        <p className="text-sm text-slate-500">No projects</p>
                      ) : (
                        <div className="space-y-2">
                          {org.domains.map((domain: any) => (
                            <div
                              key={domain.domain_id}
                              className="px-3 py-2 bg-slate-50 rounded text-sm text-slate-700"
                            >
                              <div className="font-medium">{domain.hostname}</div>
                              <div className="text-xs text-slate-600 mt-0.5">Port {domain.port}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Members */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-slate-900">Members</h4>
                        <button
                          type="button"
                          onClick={() => onAddMember(org.org_id)}
                          className="text-xs px-2.5 py-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors"
                        >
                          Add member
                        </button>
                      </div>
                      {org.members.length === 0 ? (
                        <p className="text-sm text-slate-500">No members</p>
                      ) : (
                        <div className="space-y-2">
                          {org.members.map((member: any) => (
                            <div
                              key={member.user_id}
                              className="px-3 py-2 bg-slate-50 rounded flex items-center justify-between"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-slate-900 truncate">
                                  {member.display_name || member.email}
                                </div>
                                {member.display_name && (
                                  <div className="text-xs text-slate-600 truncate">{member.email}</div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                <span className="text-xs px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 font-medium">
                                  {member.role}
                                </span>
                                {member.role !== "owner" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onTransferOwnership(
                                          org.org_id,
                                          member.user_id,
                                          member.display_name || member.email,
                                        )
                                      }
                                      disabled={transferring === member.user_id}
                                      className="text-xs px-2 py-1 text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                      {transferring === member.user_id ? "..." : "Make owner"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onRemoveMember(org.org_id, member.user_id)}
                                      disabled={removing === member.user_id}
                                      className="text-xs px-2 py-1 text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                      {removing === member.user_id ? "..." : "Remove"}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
