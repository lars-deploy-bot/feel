import { Hono } from "hono"
import type { AppBindings } from "../../../types/hono"
import { getContainers } from "./docker.service"

export const dockerRoutes = new Hono<AppBindings>()

dockerRoutes.get("/", async c => {
  const containers = await getContainers()
  return c.json({ ok: true as const, data: containers })
})
