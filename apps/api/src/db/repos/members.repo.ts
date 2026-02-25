import { iam } from "../clients"
import { InternalError } from "../../infra/errors"

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

  if (error) {
    throw new InternalError(`Failed to fetch members for org ${orgId}: ${error.message}`)
  }
  // The Supabase join returns a slightly different shape; normalize it.
  return (data ?? []) as unknown as MemberRow[]
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

  if (error) {
    throw new InternalError(`Failed to fetch all memberships: ${error.message}`)
  }
  return (data ?? []) as unknown as MemberRow[]
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
  // Set current owner(s) to "member"
  const { error: demoteError } = await iam
    .from("org_memberships")
    .update({ role: "member" })
    .eq("org_id", orgId)
    .eq("role", "owner")

  if (demoteError) {
    throw new InternalError(`Failed to demote current owner: ${demoteError.message}`)
  }

  // Set new owner
  const { error: promoteError } = await iam
    .from("org_memberships")
    .update({ role: "owner" })
    .eq("org_id", orgId)
    .eq("user_id", newOwnerId)

  if (promoteError) {
    throw new InternalError(`Failed to promote new owner: ${promoteError.message}`)
  }
}
