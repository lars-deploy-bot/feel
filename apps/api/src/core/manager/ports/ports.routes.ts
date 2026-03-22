import { Hono } from "hono"
import type { AppBindings } from "../../../types/hono"
import { getListeningPorts } from "./ports.service"

export const portsRoutes = new Hono<AppBindings>()

portsRoutes.get("/", async c => {
  const ports = await getListeningPorts()
  return c.json({ ok: true as const, data: ports })
})
