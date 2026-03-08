import { Hono } from "hono"
import type { AppBindings } from "../../../types/hono"
import { listAutomations } from "./automations.service"

export const automationsRoutes = new Hono<AppBindings>()

// GET /api/manager/automations - list all automations grouped by org
automationsRoutes.get("/", async c => {
  const data = await listAutomations()
  return c.json({ ok: true, data })
})
