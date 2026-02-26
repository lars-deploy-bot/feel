import { Hono } from "hono"
import type { AppBindings } from "../../../types/hono"
import { listFeedback } from "./feedback.service"

export const feedbackRoutes = new Hono<AppBindings>()

// TODO: Add full CRUD routes for feedback management

// GET /api/manager/feedback - list all feedback
feedbackRoutes.get("/", async c => {
  const feedback = await listFeedback()
  return c.json({ ok: true, data: feedback })
})
