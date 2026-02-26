import { Hono } from "hono"
import type { AppBindings } from "../../../types/hono"
import { listDomains } from "./domains.service"

export const domainsRoutes = new Hono<AppBindings>()

// GET /api/manager/domains - list all domains (optionally filter by orgId)
domainsRoutes.get("/", async c => {
  const orgId = c.req.query("orgId")
  const domains = await listDomains(orgId)
  return c.json({ ok: true, data: domains })
})
