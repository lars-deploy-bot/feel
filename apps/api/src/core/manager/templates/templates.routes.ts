import { Hono } from "hono"
import type { AppBindings } from "../../../types/hono"
import { listTemplates } from "./templates.service"

export const templatesRoutes = new Hono<AppBindings>()

// TODO: Add full CRUD routes for templates management

// GET /api/manager/templates - list all templates
templatesRoutes.get("/", async c => {
  const templates = await listTemplates()
  return c.json({ ok: true, data: templates })
})
