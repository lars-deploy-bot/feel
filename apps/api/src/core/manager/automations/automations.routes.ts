import { Hono } from "hono"
import type { AppBindings } from "../../../types/hono"
import { deleteJob, listAutomations, toggleJobActive, updateJob } from "./automations.service"
import { textToCron } from "./text-to-cron"

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

// PATCH /api/manager/automations/:id - update job fields
automationsRoutes.patch("/:id", async c => {
  const id = c.req.param("id")
  const body = await c.req.json<Record<string, unknown>>()

  const allowed = [
    "name",
    "description",
    "action_prompt",
    "action_model",
    "action_target_page",
    "cron_schedule",
    "cron_timezone",
  ]
  const fields: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      fields[key] = body[key]
    }
  }

  if (Object.keys(fields).length === 0) {
    return c.json({ ok: false, error: "No valid fields to update" }, 400)
  }

  await updateJob(id, fields)
  return c.json({ ok: true })
})

// POST /api/manager/automations/text-to-cron - convert natural language to cron
automationsRoutes.post("/text-to-cron", async c => {
  const body = await c.req.json<{ text: string }>()
  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    return c.json({ ok: false, error: "text is required" }, 400)
  }
  const result = await textToCron(body.text.trim())
  return c.json({ ok: true, data: result })
})

// DELETE /api/manager/automations/:id - delete a job
automationsRoutes.delete("/:id", async c => {
  const id = c.req.param("id")
  await deleteJob(id)
  return c.json({ ok: true })
})
