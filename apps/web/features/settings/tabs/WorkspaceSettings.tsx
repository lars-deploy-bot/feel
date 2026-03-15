"use client"

import type { OrgRole } from "@webalive/shared"
import { Building2, ChevronDown, UserMinus } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { DeleteModal } from "@/components/modals/DeleteModal"
import type { Organization } from "@/lib/api/types"
import { useOrganizations } from "@/lib/hooks/useOrganizations"
import { canInviteMembers, canRemoveMember } from "@/lib/permissions/org-permissions"
import { useCurrentWorkspace, useSelectedOrgId, useWorkspaceActions } from "@/lib/stores/workspaceStore"
import { useAddOrgMember } from "@/lib/tanstack"
import { input, primaryButton, secondaryButton, smallButton, text } from "../styles"
import { SettingsTabLayout } from "./SettingsTabLayout"

interface OrgMember {
  user_id: string
  email: string
  display_name: string | null
  role: OrgRole
}

// Hook: Organization name editing
function useOrgEditor(refetch: () => Promise<void>) {
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null)
  const [editOrgName, setEditOrgName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startEdit = (org: Organization) => {
    setEditingOrgId(org.org_id)
    setEditOrgName(org.name)
  }

  const cancelEdit = () => {
    setEditingOrgId(null)
    setEditOrgName("")
    setError(null)
  }

  const saveEdit = async (orgId: string) => {
    if (!editOrgName.trim()) return

    try {
      setSaving(true)
      setError(null)

      const res = await fetch("/api/auth/organizations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ org_id: orgId, name: editOrgName.trim() }),
      })

      const data = await res.json()

      if (data.ok) {
        await refetch()
        setEditingOrgId(null)
        setEditOrgName("")
      } else {
        setError(data.error || "Failed to update organization")
      }
    } catch (err) {
      console.error("Failed to update organization:", err)
      setError("Failed to update organization")
    } finally {
      setSaving(false)
    }
  }

  return { editingOrgId, editOrgName, setEditOrgName, saving, error, startEdit, cancelEdit, saveEdit }
}

// Hook: Organization members management
function useOrgMembers() {
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null)
  const [orgMembers, setOrgMembers] = useState<Record<string, OrgMember[]>>({})
  const [loadingMembers, setLoadingMembers] = useState<Record<string, boolean>>({})
  const [removingMember, setRemovingMember] = useState<string | null>(null)
  const [memberToRemove, setMemberToRemove] = useState<{ orgId: string; userId: string; email: string } | null>(null)

  const fetchMembers = useCallback(async (orgId: string) => {
    try {
      setLoadingMembers(prev => ({ ...prev, [orgId]: true }))
      const res = await fetch(`/api/auth/org-members?orgId=${orgId}`, { credentials: "include" })
      const data = await res.json()
      if (data.ok) {
        setOrgMembers(prev => ({ ...prev, [orgId]: data.members }))
      }
    } catch (err) {
      console.error("Failed to fetch members:", err)
    } finally {
      setLoadingMembers(prev => ({ ...prev, [orgId]: false }))
    }
  }, [])

  const toggleMembers = useCallback(
    async (orgId: string) => {
      if (expandedOrgId === orgId) {
        setExpandedOrgId(null)
        return
      }
      setExpandedOrgId(orgId)
      if (!orgMembers[orgId]) {
        await fetchMembers(orgId)
      }
    },
    [expandedOrgId, orgMembers, fetchMembers],
  )

  // Fetch members for an org if not already loaded (no toggle side-effect)
  const ensureMembers = useCallback(
    (orgId: string) => {
      if (!orgMembers[orgId]) {
        fetchMembers(orgId)
      }
    },
    [orgMembers, fetchMembers],
  )

  const requestRemoveMember = useCallback((orgId: string, userId: string, email: string) => {
    setMemberToRemove({ orgId, userId, email })
  }, [])

  const confirmRemoveMember = useCallback(async () => {
    if (!memberToRemove) return

    const { orgId, userId, email } = memberToRemove

    try {
      setRemovingMember(userId)
      setMemberToRemove(null)

      const res = await fetch("/api/auth/org-members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orgId, targetUserId: userId }),
      })

      const data = await res.json()

      if (data.ok) {
        setOrgMembers(prev => ({ ...prev, [orgId]: prev[orgId].filter(m => m.user_id !== userId) }))
        toast(`Removed ${email}`)
      } else {
        toast(data.message || "Couldn't remove member")
      }
    } catch (err) {
      console.error("Failed to remove member:", err)
      toast("Couldn't remove member")
    } finally {
      setRemovingMember(null)
    }
  }, [memberToRemove])

  const cancelRemoveMember = useCallback(() => setMemberToRemove(null), [])

  return useMemo(
    () => ({
      expandedOrgId,
      orgMembers,
      loadingMembers,
      removingMember,
      memberToRemove,
      toggleMembers,
      ensureMembers,
      fetchMembers,
      requestRemoveMember,
      confirmRemoveMember,
      cancelRemoveMember,
    }),
    [
      expandedOrgId,
      orgMembers,
      loadingMembers,
      removingMember,
      memberToRemove,
      toggleMembers,
      ensureMembers,
      fetchMembers,
      requestRemoveMember,
      confirmRemoveMember,
      cancelRemoveMember,
    ],
  )
}

// Hook: Leave organization
function useOrgLeave() {
  const [leavingOrg, setLeavingOrg] = useState<string | null>(null)
  const [orgToLeave, setOrgToLeave] = useState<{ orgId: string; orgName: string } | null>(null)

  const requestLeave = (orgId: string, orgName: string) => {
    setOrgToLeave({ orgId, orgName })
  }

  const confirmLeave = async () => {
    if (!orgToLeave) return

    const { orgId, orgName } = orgToLeave

    try {
      setLeavingOrg(orgId)
      setOrgToLeave(null)

      const res = await fetch("/api/auth/org-members/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orgId }),
      })

      const data = await res.json()

      if (data.ok) {
        toast(`Left ${orgName}`)
        window.location.reload()
      } else {
        toast(data.message || "Couldn't leave organization")
      }
    } catch (err) {
      console.error("Failed to leave org:", err)
      toast("Couldn't leave organization")
    } finally {
      setLeavingOrg(null)
    }
  }

  const cancelLeave = () => setOrgToLeave(null)

  return { leavingOrg, orgToLeave, requestLeave, confirmLeave, cancelLeave }
}

// Custom hook for workspace switching
// Uses the store as the single source of truth
function useWorkspaceSwitch() {
  const currentWorkspace = useCurrentWorkspace()
  const { setCurrentWorkspace } = useWorkspaceActions()
  const [optimisticWorkspace, setOptimisticWorkspace] = useState<string | null>(null)

  const switchWorkspace = useCallback(
    (workspace: string, orgId: string) => {
      // Optimistic update for immediate feedback
      setOptimisticWorkspace(workspace)
      // Update the store (single source of truth)
      setCurrentWorkspace(workspace, orgId)
      // Navigate to chat
      setTimeout(() => {
        window.location.href = "/chat"
      }, 100)
    },
    [setCurrentWorkspace],
  )

  return {
    currentWorkspace: optimisticWorkspace || currentWorkspace,
    switchWorkspace,
  }
}

export { useWorkspaceSwitch }

export function WorkspaceSettings() {
  const { organizations, currentUserId, loading, error, refetch } = useOrganizations()
  const selectedOrgId = useSelectedOrgId()

  // Use extracted hooks for clean state management
  const editor = useOrgEditor(refetch)
  const members = useOrgMembers()
  const leave = useOrgLeave()

  const [inviteEmail, setInviteEmail] = useState("")
  const addMember = useAddOrgMember({
    onSuccess: () => {
      setInviteEmail("")
      if (selectedOrgId) members.fetchMembers(selectedOrgId)
    },
  })

  // Auto-fetch members when org is selected
  useEffect(() => {
    if (selectedOrgId) {
      members.ensureMembers(selectedOrgId)
    }
  }, [selectedOrgId, members.ensureMembers])

  const getCurrentUserRole = (orgId: string): OrgRole | null => {
    const org = organizations.find(o => o.org_id === orgId)
    return org?.role ?? null
  }

  const handleInvite = () => {
    const email = inviteEmail.trim()
    if (!email || !selectedOrgId) return
    addMember.mutate({ orgId: selectedOrgId, email })
  }

  const selectedOrg = organizations.find(org => org.org_id === selectedOrgId) ?? organizations[0] ?? null

  return (
    <SettingsTabLayout
      title={selectedOrg?.name ?? "Organization"}
      description="Manage your team and organization settings"
    >
      {/* Errors */}
      {error && (
        <div className="px-4 py-3 bg-red-500/5 dark:bg-red-500/5 border border-red-500/10 dark:border-red-500/10 rounded-xl space-y-2">
          <p className={text.error} data-testid="org-error-message">
            {error}
          </p>
          <button type="button" onClick={refetch} className={smallButton} data-testid="org-error-retry">
            Retry
          </button>
        </div>
      )}
      {editor.error && (
        <div
          className={`px-4 py-3 bg-red-500/5 dark:bg-red-500/5 border border-red-500/10 dark:border-red-500/10 rounded-xl ${text.error}`}
        >
          {editor.error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-8 h-8 border-2 border-black/[0.08] dark:border-white/[0.08] border-t-black/60 dark:border-t-white/60 rounded-full animate-spin" />
          <p className={text.muted}>Loading</p>
        </div>
      ) : !selectedOrg ? (
        <div className="text-center py-12">
          <Building2 size={48} strokeWidth={1} className="mx-auto mb-4 text-black/20 dark:text-white/20" />
          <p className={`${text.description} mb-4`}>No organization selected</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Quick Summary Bar */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-black/50 dark:text-white/50">
            <span>
              <strong className="text-black/90 dark:text-white/90">{selectedOrg.credits.toFixed(2)}</strong> credits
            </span>
            <span className="hidden sm:inline text-black/20 dark:text-white/20">•</span>
            <span>
              <strong className="text-black/90 dark:text-white/90">{selectedOrg.workspace_count || 0}</strong> projects
            </span>
            <span className="hidden sm:inline text-black/20 dark:text-white/20">•</span>
            <span>
              <strong className="text-black/90 dark:text-white/90">
                {members.orgMembers[selectedOrg.org_id]?.length || 0}
              </strong>{" "}
              members
            </span>
          </div>

          {/* PRIMARY: Invite Section */}
          {canInviteMembers(getCurrentUserRole(selectedOrg.org_id)) && (
            <div className="space-y-3">
              <div>
                <h4 className={text.label}>Invite teammates</h4>
                <p className={text.description}>
                  Give access to <strong>{selectedOrg.name}</strong> workspace and shared credits
                </p>
              </div>
              <form
                className="flex gap-2"
                onSubmit={e => {
                  e.preventDefault()
                  handleInvite()
                }}
              >
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  disabled={addMember.isPending}
                  className={`flex-1 ${input}`}
                />
                <button type="submit" disabled={addMember.isPending || !inviteEmail.trim()} className={primaryButton}>
                  {addMember.isPending ? "Inviting..." : "Invite"}
                </button>
              </form>
            </div>
          )}

          {/* Members List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className={text.label}>Members</h4>
            </div>

            {members.loadingMembers[selectedOrg.org_id] ? (
              <div className="py-8 text-center">
                <div className="inline-block w-5 h-5 border-2 border-black/[0.08] dark:border-white/[0.08] border-t-black/60 dark:border-t-white/60 rounded-full animate-spin" />
              </div>
            ) : members.orgMembers[selectedOrg.org_id] && members.orgMembers[selectedOrg.org_id].length > 0 ? (
              <div className="space-y-2">
                {members.orgMembers[selectedOrg.org_id].map(member => {
                  const currentUserRole = getCurrentUserRole(selectedOrg.org_id)
                  const isCurrentUser = member.user_id === currentUserId
                  const canRemove = canRemoveMember(currentUserRole, member.role, isCurrentUser)

                  return (
                    <div
                      key={member.user_id}
                      className="flex items-start sm:items-center justify-between px-3 py-3 rounded-xl border border-black/[0.06] dark:border-white/[0.06] hover:border-black/[0.12] dark:hover:border-white/[0.12] transition-colors duration-150 gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-0.5">
                          <span className="text-sm font-medium text-black/90 dark:text-white/90 truncate max-w-[180px] sm:max-w-none">
                            {member.display_name || member.email}
                            {isCurrentUser && <span className={`ml-1 ${text.muted} font-normal`}>(you)</span>}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-lg font-medium flex-shrink-0 ${
                              member.role === "owner"
                                ? "bg-violet-500/10 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400"
                                : member.role === "admin"
                                  ? "bg-blue-500/10 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                  : "bg-black/[0.04] dark:bg-white/[0.06] text-black/60 dark:text-white/60"
                            }`}
                          >
                            {member.role}
                          </span>
                        </div>
                        <div className={`${text.muted} truncate`}>{member.email}</div>
                      </div>

                      {canRemove && (
                        <button
                          type="button"
                          onClick={() => members.requestRemoveMember(selectedOrg.org_id, member.user_id, member.email)}
                          disabled={members.removingMember === member.user_id}
                          className="flex-shrink-0 p-2 sm:p-1.5 text-red-500/70 dark:text-red-400/70 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/10 rounded-xl transition-colors duration-150 disabled:opacity-40"
                          title="Remove member"
                        >
                          <UserMinus size={18} strokeWidth={1.75} className="sm:w-4 sm:h-4" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={`py-8 text-center ${text.muted}`}>No members yet. Invite someone above!</div>
            )}
          </div>

          {/* Advanced Actions */}
          <details className="group">
            <summary className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] cursor-pointer transition-colors duration-150">
              <span className={text.label}>Advanced</span>
              <ChevronDown
                size={16}
                strokeWidth={1.75}
                className="text-black/40 dark:text-white/40 group-open:rotate-180 transition-transform duration-150"
              />
            </summary>
            <div className="mt-3 space-y-3 px-1">
              {/* Rename Organization */}
              <div>
                <label htmlFor="org-name-input" className={`block ${text.label} mb-2`}>
                  Organization name
                </label>
                {editor.editingOrgId === selectedOrg.org_id ? (
                  <div className="flex gap-2">
                    <input
                      id="org-name-input"
                      type="text"
                      value={editor.editOrgName}
                      onChange={e => editor.setEditOrgName(e.target.value)}
                      className={`flex-1 ${input}`}
                    />
                    <button
                      type="button"
                      onClick={() => editor.saveEdit(selectedOrg.org_id)}
                      disabled={!editor.editOrgName.trim() || editor.saving}
                      className={primaryButton}
                    >
                      {editor.saving ? "..." : "Save"}
                    </button>
                    <button type="button" onClick={editor.cancelEdit} className={secondaryButton}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-3 py-2.5 bg-black/[0.03] dark:bg-white/[0.03] rounded-xl">
                    <span className="text-sm text-black/80 dark:text-white/80">{selectedOrg.name}</span>
                    <button
                      type="button"
                      onClick={() => editor.startEdit(selectedOrg)}
                      className={`${text.description} hover:text-black/80 dark:hover:text-white/80 transition-colors`}
                    >
                      Rename
                    </button>
                  </div>
                )}
              </div>

              {/* Leave Organization */}
              <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => leave.requestLeave(selectedOrg.org_id, selectedOrg.name)}
                  disabled={leave.leavingOrg === selectedOrg.org_id}
                  className="text-xs text-red-500/60 dark:text-red-400/60 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-150 disabled:opacity-40"
                >
                  {leave.leavingOrg === selectedOrg.org_id ? "Leaving..." : "Leave organization"}
                </button>
              </div>
            </div>
          </details>
        </div>
      )}

      {/* Delete Member Confirmation Modal */}
      {members.memberToRemove && (
        <DeleteModal
          title="Remove Member"
          message={
            <>
              Are you sure you want to remove <strong>{members.memberToRemove.email}</strong> from this organization?
              <br />
              <br />
              This action cannot be undone.
            </>
          }
          confirmText="Remove"
          onConfirm={members.confirmRemoveMember}
          onCancel={members.cancelRemoveMember}
        />
      )}

      {/* Leave Organization Confirmation Modal */}
      {leave.orgToLeave && (
        <DeleteModal
          title="Leave Organization"
          message={
            <>
              Are you sure you want to leave <strong>{leave.orgToLeave.orgName}</strong>?
              <br />
              <br />
              This action cannot be undone.
            </>
          }
          confirmText="Leave"
          onConfirm={leave.confirmLeave}
          onCancel={leave.cancelLeave}
        />
      )}
    </SettingsTabLayout>
  )
}
