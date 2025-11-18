/**
 * Organization management service - pure, testable functions
 */

export interface OrgDeleteRequest {
  orgId: string
}

export interface RemoveMemberRequest {
  orgId: string
  userId: string
}

export interface TransferOwnershipRequest {
  orgId: string
  newOwnerId: string
}

export interface UpdateCreditsRequest {
  orgId: string
  credits: number
}

export interface AddMemberRequest {
  orgId: string
  userId: string
  role: "owner" | "admin" | "member"
}

export async function deleteOrg(orgId: string): Promise<void> {
  const response = await fetch("/api/manager/orgs/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId }),
  })

  if (!response.ok) {
    throw new Error("Failed to delete organization")
  }
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  const response = await fetch("/api/manager/orgs/members/remove", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId, userId }),
  })

  if (!response.ok) {
    throw new Error("Failed to remove member")
  }
}

export async function transferOwnership(orgId: string, newOwnerId: string): Promise<void> {
  const response = await fetch("/api/manager/orgs/transfer-ownership", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId, newOwnerId }),
  })

  if (!response.ok) {
    throw new Error("Failed to transfer ownership")
  }
}

export async function updateOrgCredits(orgId: string, credits: number): Promise<void> {
  const response = await fetch("/api/manager/orgs/credits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId, credits }),
  })

  if (!response.ok) {
    throw new Error("Failed to update organization credits")
  }
}

export async function addOrgMember(orgId: string, userId: string, role: "owner" | "admin" | "member"): Promise<void> {
  const response = await fetch("/api/manager/orgs/members/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId, userId, role }),
  })

  if (!response.ok) {
    throw new Error("Failed to add member")
  }
}
