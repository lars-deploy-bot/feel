import { InternalError } from "../../infra/errors"
import { iam } from "../clients"

export type MemberRow = {
  org_id: string
  user_id: string
  role: string
  created_at: string | null
  users: {
    user_id: string
    email: string | null
    display_name: string | null
  } | null
}

export async function findByOrgId(orgId: string): Promise<MemberRow[]> {
  const { data, error } = await iam
    .from("org_memberships")
    .select(
      `
      org_id,
      user_id,
      role,
      created_at,
      users:user_id (
        user_id,
        email,
        display_name
      )
    `,
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .overrideTypes<MemberRow[], { merge: false }>()

  if (error) {
    throw new InternalError(`Failed to fetch members for org ${orgId}: ${error.message}`)
  }
  return data ?? []
}

export async function findAllGrouped(): Promise<MemberRow[]> {
  const { data, error } = await iam
    .from("org_memberships")
    .select(
      `
      org_id,
      user_id,
      role,
      created_at,
      users:user_id (
        user_id,
        email,
        display_name
      )
    `,
    )
    .order("created_at", { ascending: false })
    .overrideTypes<MemberRow[], { merge: false }>()

  if (error) {
    throw new InternalError(`Failed to fetch all memberships: ${error.message}`)
  }
  return data ?? []
}

export async function add(orgId: string, userId: string, role: string): Promise<void> {
  const { error } = await iam.from("org_memberships").insert({
    org_id: orgId,
    user_id: userId,
    role,
  })

  if (error) {
    throw new InternalError(`Failed to add member: ${error.message}`)
  }
}

export async function remove(orgId: string, userId: string): Promise<void> {
  const { error } = await iam.from("org_memberships").delete().eq("org_id", orgId).eq("user_id", userId)

  if (error) {
    throw new InternalError(`Failed to remove member: ${error.message}`)
  }
}

export async function transferOwnership(orgId: string, newOwnerId: string): Promise<void> {
  // Find the current owner(s) so we can roll back if the promote step fails
  const { data: currentOwners, error: lookupError } = await iam
    .from("org_memberships")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role", "owner")

  if (lookupError) {
    throw new InternalError(`Failed to look up current owner: ${lookupError.message}`)
  }
  if (!currentOwners || currentOwners.length === 0) {
    throw new InternalError(`Org ${orgId} has no current owner`)
  }

  const currentOwnerIds = currentOwners.map(row => row.user_id)

  // Demote current owner(s) to "member"
  const { error: demoteError } = await iam
    .from("org_memberships")
    .update({ role: "member" })
    .eq("org_id", orgId)
    .eq("role", "owner")

  if (demoteError) {
    throw new InternalError(`Failed to demote current owner: ${demoteError.message}`)
  }

  // Promote new owner
  const { error: promoteError } = await iam
    .from("org_memberships")
    .update({ role: "owner" })
    .eq("org_id", orgId)
    .eq("user_id", newOwnerId)

  if (promoteError) {
    // Rollback: re-promote the original owner(s) to prevent ownerless org
    for (const ownerId of currentOwnerIds) {
      await iam.from("org_memberships").update({ role: "owner" }).eq("org_id", orgId).eq("user_id", ownerId)
    }
    throw new InternalError(`Failed to promote new owner (rolled back demote): ${promoteError.message}`)
  }
}
