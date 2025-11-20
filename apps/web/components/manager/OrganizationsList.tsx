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
      <div className="px-6 py-5 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {orgs.length} organization{orgs.length !== 1 ? "s" : ""}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="text-xs px-2.5 py-1.5 text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 dark:bg-[#333] dark:text-slate-300 dark:border-white/20 dark:hover:bg-[#444] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div>
        {loading ? (
          <div className="text-center py-12 px-6">
            <p className="text-sm text-slate-600 dark:text-slate-400">Loading organizations...</p>
          </div>
        ) : orgs.length === 0 ? (
          <div className="text-center py-12 px-6">
            <p className="text-sm text-slate-600 dark:text-slate-400">No organizations found</p>
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
              Organizations will appear here when created
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-white/10">
            {orgs.map(org => (
              <div key={org.org_id} className="hover:bg-slate-50 dark:hover:bg-[#333]">
                {/* Organization Header */}
                <div className="px-6 py-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <button
                        type="button"
                        onClick={() => setExpandedOrg(expandedOrg === org.org_id ? null : org.org_id)}
                        className="text-left hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{org.name}</h3>
                      </button>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-600 dark:text-slate-400">
                        <span>
                          Credits:{" "}
                          <span className="font-medium text-slate-900 dark:text-white">{org.credits.toFixed(2)}</span>
                        </span>
                        <span>Members: {org.member_count}</span>
                        <span>Projects: {org.domain_count}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>Created {new Date(org.created_at).toLocaleDateString()}</span>
                        <span className="text-slate-400 dark:text-slate-500">•</span>
                        <span className="font-mono text-xs">{org.org_id}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEditCredits(org.org_id, org.credits)}
                        className="text-xs px-2.5 py-1.5 text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800 dark:hover:bg-indigo-900/40 transition-colors"
                      >
                        Edit credits
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(org.org_id)}
                        disabled={deleting === org.org_id}
                        className="text-xs px-2.5 py-1.5 text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {deleting === org.org_id ? "Deleting..." : "Delete"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedOrg(expandedOrg === org.org_id ? null : org.org_id)}
                        className="text-xs px-2.5 py-1.5 text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 dark:bg-[#333] dark:text-slate-300 dark:border-white/20 dark:hover:bg-[#444] transition-colors"
                      >
                        {expandedOrg === org.org_id ? "Collapse" : "Expand"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedOrg === org.org_id && (
                  <div className="px-6 py-5 bg-white dark:bg-[#2a2a2a] border-t border-slate-200 dark:border-white/10 space-y-6">
                    {/* Projects */}
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Projects</h4>
                      {org.domains.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">No projects</p>
                      ) : (
                        <div className="space-y-2">
                          {org.domains.map((domain: any) => (
                            <div
                              key={domain.domain_id}
                              className="px-3 py-2 bg-slate-50 dark:bg-[#333] rounded text-sm text-slate-700 dark:text-slate-300"
                            >
                              <div className="font-medium">{domain.hostname}</div>
                              <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                Port {domain.port}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Members */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Members</h4>
                        <button
                          type="button"
                          onClick={() => onAddMember(org.org_id)}
                          className="text-xs px-2.5 py-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/40 transition-colors"
                        >
                          Add member
                        </button>
                      </div>
                      {org.members.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">No members</p>
                      ) : (
                        <div className="space-y-2">
                          {org.members.map((member: any) => (
                            <div
                              key={member.user_id}
                              className="px-3 py-2 bg-slate-50 dark:bg-[#333] rounded flex items-center justify-between"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                  {member.display_name || member.email}
                                </div>
                                {member.display_name && (
                                  <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                                    {member.email}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                <span className="text-xs px-2 py-1 bg-white dark:bg-[#444] border border-slate-200 dark:border-white/20 rounded text-slate-700 dark:text-slate-300 font-medium">
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
                                      className="text-xs px-2 py-1 text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800 dark:hover:bg-indigo-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                      {transferring === member.user_id ? "..." : "Make owner"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onRemoveMember(org.org_id, member.user_id)}
                                      disabled={removing === member.user_id}
                                      className="text-xs px-2 py-1 text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
