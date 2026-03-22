import { type Context, Hono } from "hono"
import { z } from "zod"
import { ValidationError } from "../../../infra/errors"
import { validate } from "../../../shared/validation"
import type { AppBindings } from "../../../types/hono"
import { deleteJob, listAutomations, toggleJobActive, updateJob } from "./automations.service"
import { textToCron } from "./text-to-cron"
import { checkTextToCronLimit } from "./text-to-cron-limiter"

export const automationsRoutes = new Hono<AppBindings>()

const toggleJobActiveSchema = z.object({
  is_active: z.boolean(),
})

const updateJobSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).nullable().optional(),
    action_prompt: z.string().trim().min(1).nullable().optional(),
    action_model: z.string().trim().min(1).nullable().optional(),
    action_target_page: z.string().trim().min(1).nullable().optional(),
    cron_schedule: z.string().trim().min(1).nullable().optional(),
    cron_timezone: z.string().trim().min(1).nullable().optional(),
  })
  .strict()
  .refine(fields => Object.keys(fields).length > 0, {
    message: "At least one field is required",
  })

const textToCronSchema = z
  .object({
    text: z.string().trim().min(1).max(200),
    user_id: z.string().min(1),
  })
  .strict()

async function readJson(c: Context<AppBindings>): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    throw new ValidationError("Invalid JSON body")
  }
}

// GET /api/manager/automations - list all automations grouped by org
automationsRoutes.get("/", async c => {
  const data = await listAutomations()
  return c.json({ ok: true, data })
})

// PATCH /api/manager/automations/:id/active - toggle job active state
automationsRoutes.patch("/:id/active", async c => {
  const id = c.req.param("id")
  const body = validate(toggleJobActiveSchema, await readJson(c))
  await toggleJobActive(id, body.is_active)
  return c.json({ ok: true })
})

// PATCH /api/manager/automations/:id - update job fields
automationsRoutes.patch("/:id", async c => {
  const id = c.req.param("id")
  const fields = validate(updateJobSchema, await readJson(c))
  await updateJob(id, fields)
  return c.json({ ok: true })
})

// POST /api/manager/automations/text-to-cron - convert natural language to cron
automationsRoutes.post("/text-to-cron", async c => {
  const body = validate(textToCronSchema, await readJson(c))
  await checkTextToCronLimit(body.user_id)
  const result = await textToCron(body.text)
  return c.json({ ok: true, data: result })
})

// DELETE /api/manager/automations/:id - delete a job
automationsRoutes.delete("/:id", async c => {
  const id = c.req.param("id")
  await deleteJob(id)
  return c.json({ ok: true })
})
