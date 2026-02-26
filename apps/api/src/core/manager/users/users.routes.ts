import { Hono } from "hono"
import { fetchUserEvents, fetchUserProfile } from "../../../infra/posthog"
import type { AppBindings } from "../../../types/hono"
import { getUserById, listUsers } from "./users.service"

export const usersRoutes = new Hono<AppBindings>()

// GET /api/manager/users - list all users
usersRoutes.get("/", async c => {
  const users = await listUsers()
  return c.json({ ok: true, data: users })
})

// GET /api/manager/users/:id - get user by ID
usersRoutes.get("/:id", async c => {
  const userId = c.req.param("id")
  const user = await getUserById(userId)
  return c.json({ ok: true, data: user })
})

// GET /api/manager/users/:id/profile - get geo/device profile from PostHog
usersRoutes.get("/:id/profile", async c => {
  const userId = c.req.param("id")
  const profile = await fetchUserProfile(userId)
  return c.json({ ok: true, data: profile })
})

// GET /api/manager/users/:id/events - get PostHog events for a user
usersRoutes.get("/:id/events", async c => {
  const userId = c.req.param("id")
  const limit = Number(c.req.query("limit") ?? "50")
  const eventType = c.req.query("event") ?? undefined

  const events = await fetchUserEvents(userId, { limit, eventType })
  return c.json({ ok: true, data: events })
})
