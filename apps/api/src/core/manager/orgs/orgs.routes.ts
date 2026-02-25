import { Hono } from "hono"
import type { AppBindings } from "../../../types/hono"
import { validate } from "../../../shared/validation"
import { createOrgBodySchema, updateCreditsBodySchema, addMemberBodySchema } from "./orgs.schemas"
import { listOrgs, createOrg, updateOrgCredits, deleteOrg, addMember, removeMember } from "./orgs.service"

export const orgsRoutes = new Hono<AppBindings>()

// GET /api/manager/orgs - list all orgs with members + domains
orgsRoutes.get("/", async c => {
  const orgs = await listOrgs()
  return c.json({ ok: true, data: orgs })
})

// POST /api/manager/orgs - create org
orgsRoutes.post("/", async c => {
  const body = await c.req.json()
  const { name, credits, ownerUserId } = validate(createOrgBodySchema, body)
  const org = await createOrg(name, credits, ownerUserId)
  return c.json({ ok: true, data: org }, 201)
})

// PATCH /api/manager/orgs/:id/credits - update credits
orgsRoutes.patch("/:id/credits", async c => {
  const orgId = c.req.param("id")
  const body = await c.req.json()
  const { credits } = validate(updateCreditsBodySchema, body)
  const org = await updateOrgCredits(orgId, credits)
  return c.json({ ok: true, data: org })
})

// DELETE /api/manager/orgs/:id - delete org (cascade: nullify domains, delete invites, delete memberships, delete org)
orgsRoutes.delete("/:id", async c => {
  const orgId = c.req.param("id")
  await deleteOrg(orgId)
  return c.json({ ok: true })
})

// POST /api/manager/orgs/:id/members - add member
orgsRoutes.post("/:id/members", async c => {
  const orgId = c.req.param("id")
  const body = await c.req.json()
  const { userId, role } = validate(addMemberBodySchema, body)
  await addMember(orgId, userId, role)
  return c.json({ ok: true }, 201)
})

// DELETE /api/manager/orgs/:id/members/:userId - remove member
orgsRoutes.delete("/:id/members/:userId", async c => {
  const orgId = c.req.param("id")
  const userId = c.req.param("userId")
  await removeMember(orgId, userId)
  return c.json({ ok: true })
})
