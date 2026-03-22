import { Hono } from "hono"
import type { AppBindings } from "../../../types/hono"
import { getServices } from "./services.service"

export const servicesRoutes = new Hono<AppBindings>()

servicesRoutes.get("/", async c => {
  const services = await getServices()
  return c.json({ ok: true as const, data: services })
})
