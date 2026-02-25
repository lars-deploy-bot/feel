import { useCallback, useState } from "react"
import { EmptyState } from "@/components/data/EmptyState"
import { StatCard } from "@/components/data/StatCard"
import { PageHeader } from "@/components/layout/PageHeader"
import { DeleteModal } from "@/components/overlays/DeleteModal"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"
import { AddMemberModal } from "./components/AddMemberModal"
import { CreateOrgModal } from "./components/CreateOrgModal"
import { EditCreditsModal } from "./components/EditCreditsModal"
import { OrgCard } from "./components/OrgCard"
import { useOrgs } from "./hooks/useOrgs"

export function OrgsPage() {
  const { orgs, loading, error, refresh, updateCredits, deleteOrg, addMember, removeMember, createOrg } = useOrgs()

  const [search, setSearch] = useState("")
  const [editCreditsTarget, setEditCreditsTarget] = useState<{ orgId: string; credits: number; name: string } | null>(
    null,
  )
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [addMemberTarget, setAddMemberTarget] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const filtered = search.trim()
    ? orgs.filter(org => {
        const q = search.toLowerCase()
        return (
          org.name.toLowerCase().includes(q) ||
          org.org_id.toLowerCase().includes(q) ||
          org.members.some(m => m.email.toLowerCase().includes(q))
        )
      })
    : orgs

  const totalCredits = orgs.reduce((sum, org) => sum + org.credits, 0)
  const totalMembers = orgs.reduce((sum, org) => sum + org.member_count, 0)
  const totalProjects = orgs.reduce((sum, org) => sum + org.domain_count, 0)

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await deleteOrg(deleteTarget)
      setDeleteTarget(null)
    } finally {
      setDeleteLoading(false)
    }
  }, [deleteTarget, deleteOrg])

  if (loading && orgs.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load organizations"
        description={error}
        action={<Button onClick={refresh}>Retry</Button>}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Organizations"
        description={`${orgs.length} organization${orgs.length !== 1 ? "s" : ""}`}
        action={
          <Button size="sm" variant="primary" onClick={() => setCreateOpen(true)}>
            Create
          </Button>
        }
      />

      <div className="flex gap-10 mb-8 pb-8 border-b border-border">
        <StatCard label="Organizations" value={orgs.length} />
        <StatCard label="Total Credits" value={`$${totalCredits.toFixed(2)}`} />
        <StatCard label="Members" value={totalMembers} />
        <StatCard label="Projects" value={totalProjects} />
      </div>

      <div className="mb-6">
        <Input
          placeholder="Search organizations, members, IDs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={search ? "No matches" : "No organizations"}
          description={search ? "Try a different search term" : "Create your first organization to get started"}
          action={
            !search ? (
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                Create Organization
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="divide-y divide-border">
          {filtered.map(org => (
            <OrgCard
              key={org.org_id}
              org={org}
              onEditCredits={(id, credits) => setEditCreditsTarget({ orgId: id, credits, name: org.name })}
              onDelete={id => setDeleteTarget(id)}
              onAddMember={id => setAddMemberTarget(id)}
              onRemoveMember={removeMember}
            />
          ))}
        </div>
      )}

      {editCreditsTarget && (
        <EditCreditsModal
          open
          onClose={() => setEditCreditsTarget(null)}
          onSave={credits => updateCredits(editCreditsTarget.orgId, credits)}
          currentCredits={editCreditsTarget.credits}
          orgName={editCreditsTarget.name}
        />
      )}

      <DeleteModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        entityName="Organization"
        loading={deleteLoading}
      />

      {addMemberTarget && (
        <AddMemberModal
          open
          onClose={() => setAddMemberTarget(null)}
          onAdd={(userId, role) => addMember(addMemberTarget, userId, role)}
        />
      )}

      <CreateOrgModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={createOrg} />
    </>
  )
}
