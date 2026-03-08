import { Hono } from "hono"
import type { AppBindings } from "../../../types/hono"
import { listAutomations, toggleJobActive } from "./automations.service"

export const automationsRoutes = new Hono<AppBindings>()

// GET /api/manager/automations - list all automations grouped by org
automationsRoutes.get("/", async c => {
  const data = await listAutomations()
  return c.json({ ok: true, data })
})

// PATCH /api/manager/automations/:id/active - toggle job active state
automationsRoutes.patch("/:id/active", async c => {
  const id = c.req.param("id")
  const body = await c.req.json<{ is_active: boolean }>()
  if (typeof body.is_active !== "boolean") {
    return c.json({ ok: false, error: "is_active must be a boolean" }, 400)
  }
  await toggleJobActive(id, body.is_active)
  return c.json({ ok: true })
})
