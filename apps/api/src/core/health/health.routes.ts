import { Hono } from "hono"
import type { AppBindings } from "../../types/hono"
import { getDeepHealth, getHealth } from "./health.service"

export const healthRoutes = new Hono<AppBindings>()

healthRoutes.get("/", c => {
  return c.json(getHealth())
})

healthRoutes.get("/deep", async c => {
  const status = await getDeepHealth()
  const httpStatus = status.ok ? 200 : 503
  return c.json(status, httpStatus)
})
