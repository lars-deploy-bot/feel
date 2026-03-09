import { beforeEach, describe, expect, it, vi } from "vitest"

const createIamClientMock = vi.fn()

vi.mock("@/lib/supabase/iam", () => ({
  createIamClient: (...args: unknown[]) => createIamClientMock(...args),
}))

const { createSessionToken, refreshSessionTokenWithOrg, verifySessionToken } = await import("../jwt")

describe("refreshSessionTokenWithOrg", () => {
  const user = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    email: "owner@example.com",
    name: "Owner",
  }

  beforeEach(() => {
    createIamClientMock.mockReset()
  })

  it("uses authoritative IAM roles for the refreshed org claims", async () => {
    const currentToken = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      sid: crypto.randomUUID(),
      orgIds: ["org-existing"],
      orgRoles: { "org-existing": "member" },
    })

    const eqMock = vi.fn().mockResolvedValue({
      data: [
        { org_id: "org-existing", role: "member" },
        { org_id: "org-new", role: "owner" },
      ],
    })
    const selectMock = vi.fn(() => ({ eq: eqMock }))
    const fromMock = vi.fn(() => ({ select: selectMock }))
    createIamClientMock.mockResolvedValue({ from: fromMock })

    const refreshedToken = await refreshSessionTokenWithOrg(currentToken, user, "org-new")
    expect(refreshedToken).not.toBeNull()

    const payload = await verifySessionToken(refreshedToken ?? "")
    expect(payload?.orgIds).toEqual(["org-existing", "org-new"])
    expect(payload?.orgRoles).toEqual({
      "org-existing": "member",
      "org-new": "owner",
    })
    expect(createIamClientMock).toHaveBeenCalledWith("service")
  })

  it("keeps the current token when IAM memberships do not contain the requested org", async () => {
    const currentToken = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      sid: crypto.randomUUID(),
      orgIds: ["org-existing"],
      orgRoles: { "org-existing": "member" },
    })

    const eqMock = vi.fn().mockResolvedValue({ data: [{ org_id: "org-existing", role: "member" }] })
    const selectMock = vi.fn(() => ({ eq: eqMock }))
    const fromMock = vi.fn(() => ({ select: selectMock }))
    createIamClientMock.mockResolvedValue({ from: fromMock })

    const refreshedToken = await refreshSessionTokenWithOrg(currentToken, user, "org-missing")
    expect(refreshedToken).toBe(currentToken)
  })
})
