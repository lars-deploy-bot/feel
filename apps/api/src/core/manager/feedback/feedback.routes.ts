import { Hono } from "hono"
import type { AppBindings } from "../../../types/hono"
import { listFeedback, updateFeedback } from "./feedback.service"

export const feedbackRoutes = new Hono<AppBindings>()

// GET /api/manager/feedback - list all feedback
feedbackRoutes.get("/", async c => {
  const feedback = await listFeedback()
  return c.json({ ok: true, data: feedback })
})

// PATCH /api/manager/feedback/:id - update feedback fields
feedbackRoutes.patch("/:id", async c => {
  const feedbackId = c.req.param("id")
  const body = await c.req.json<{
    github_issue_url?: string | null
    aware_email_sent?: string | null
    fixed_email_sent?: string | null
    status?: string | null
    closed_at?: string | null
  }>()

  await updateFeedback(feedbackId, body)
  return c.json({ ok: true })
})
