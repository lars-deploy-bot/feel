import { Hono } from "hono"
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
